
const NEWS_CATEGORIES = {
    "Gold & Silver": "gold OR silver prices India",
    "Stock Market": "Indian stock market Nifty Sensex",
    "Banking & RBI": "RBI Indian banking finance",
    "Economy": "India economy inflation GDP",
    "Currency": "Indian rupee USD INR exchange rate"
};

function decodeXML(value = "") {
    return value
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, code) =>
            String.fromCodePoint(Number(code))
        )
        .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
            String.fromCodePoint(parseInt(code, 16))
        )
        .trim();
}

function getTag(item, tag) {
    const regex = new RegExp(
        `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}\\s*>`,
        "i"
    );

    const match = item.match(regex);

    return match
        ? decodeXML(match[1].replace(/<[^>]+>/g, ""))
        : "";
}

export default async function handler(req, res) {
    res.setHeader("Content-Type", "application/json");

    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    const category = String(
        req.query.category || "Gold & Silver"
    );

    const searchQuery = NEWS_CATEGORIES[category];

    if (!searchQuery) {
        return res.status(400).json({
            success: false,
            message: "Unsupported news category"
        });
    }

    try {
        const url = new URL(
            "https://news.google.com/rss/search"
        );

        url.searchParams.set(
            "q",
            `${searchQuery} when:7d`
        );

        url.searchParams.set("hl", "en-IN");
        url.searchParams.set("gl", "IN");
        url.searchParams.set("ceid", "IN:en");

        const response = await fetch(url.toString(), {
            headers: {
                Accept: "application/rss+xml, application/xml, text/xml"
            },
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            throw new Error(
                `News provider error: ${response.status}`
            );
        }

        const xml = await response.text();

        const items =
            xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];

        const articles = items
            .map(item => {
                const title = getTag(item, "title");
                const link = getTag(item, "link");
                const source = getTag(item, "source");
                const publishedAt = getTag(item, "pubDate");

                return {
                    title,
                    link,
                    source: source || "Google News",
                    publishedAt
                };
            })
            .filter(article =>
                article.title &&
                /^https:\/\//i.test(article.link)
            )
            .slice(0, 12);

        res.setHeader(
            "Cache-Control",
            "public, s-maxage=300, stale-while-revalidate=300"
        );

        return res.status(200).json({
            success: true,
            category,
            count: articles.length,
            articles
        });

    } catch (error) {
        console.error(
            "Financial news API error:",
            error.message
        );

        return res.status(502).json({
            success: false,
            message: "Financial news is temporarily unavailable."
        });
    }
}
