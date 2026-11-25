
const CITY_NAMES = {
    "Vijayawada": "Vijayawada",
    "Guntur": "Guntur",
    "Visakhapatnam": "Visakhapatnam",
    "Tirupati": "Tirupati",
    "Hyderabad": "Hyderabad",
    "Bengaluru": "Bangalore",
    "Chennai": "Chennai",
    "Mumbai": "Greater Mumbai",
    "Delhi": "New Delhi",
    "Kolkata": "Kolkata",
    "Pune": "Pune",
    "Kochi": "Kochi"
};

export default async function handler(req, res) {
    res.setHeader("Content-Type", "application/json");

    if (req.method !== "GET") {
        return res.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    const apiKey = process.env.NEBULA_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            success: false,
            message: "Gold API configuration is missing"
        });
    }

    const requestedCity = String(req.query.city || "Vijayawada").trim();

    const city = CITY_NAMES[requestedCity];

    if (!city) {
        return res.status(400).json({
            success: false,
            message: "Unsupported city"
        });
    }

    try {
        const url = new URL(
            "https://workspace.nebulaapi.com/gold_price"
        );

        url.searchParams.set("city", city);
        url.searchParams.set("rate", "live");

        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "x-api-key": apiKey,
                "Accept": "application/json"
            },
            signal: AbortSignal.timeout(20000)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Nebula API error:", response.status);

            return res.status(response.status).json({
                success: false,
                message: "Unable to fetch gold rates from provider"
            });
        }

        res.setHeader(
            "Cache-Control",
            "public, s-maxage=600, stale-while-revalidate=300"
        );

        return res.status(200).json(data);

    } catch (error) {
        console.error("Gold API error:", error.message);

        return res.status(502).json({
            success: false,
            message: "Gold rate service is temporarily unavailable"
        });
    }
}
