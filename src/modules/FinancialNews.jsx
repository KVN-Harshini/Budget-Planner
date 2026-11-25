
import { useEffect, useState } from "react";
import { getUserData, setUserData } from "../utils/storage";
import "../styles/FinancialNews.css";

const CITIES = [
    "Vijayawada",
    "Guntur",
    "Visakhapatnam",
    "Tirupati",
    "Hyderabad",
    "Bengaluru",
    "Chennai",
    "Mumbai",
    "Delhi",
    "Kolkata",
    "Pune",
    "Kochi"
];

const API = "https://snapdata.dev/api/v1";

const NEWS_CATEGORIES = [
    "Gold & Silver",
    "Stock Market",
    "Banking & RBI",
    "Economy",
    "Currency"
];

const INITIAL_MARKETS = [
    {
        title: "24K Gold",
        value: "Loading...",
        unit: "₹ / gram · GST included",
        icon: "🥇"
    },
    {
        title: "22K Gold",
        value: "Loading...",
        unit: "₹ / gram · GST included",
        icon: "💛"
    },
    {
        title: "18K Gold",
        value: "Loading...",
        unit: "₹ / gram · GST included",
        icon: "✨"
    },
    {
        title: "Silver",
        value: "Loading...",
        unit: "₹ / gram · National benchmark",
        icon: "🥈"
    },
    {
        title: "USD / INR",
        value: "Loading...",
        unit: "ECB reference rate",
        icon: "💱"
    }
];

async function getJSON(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
}

function formatINR(value) {
    if (value === null || value === undefined) {
        return "Unavailable";
    }

    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
        return "Unavailable";
    }

    return "₹" + number.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function getObservation(data, instrument) {
    return data?.observations?.find(
        item => item.instrument === instrument
    );
}

function formatDate(date) {
    if (!date) return "";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
        return "";
    }

    return parsedDate.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata"
    });
}

function FinancialNews() {
    const [city, setCity] = useState(() =>
        getUserData("budgetSelectedCity", "Vijayawada")
    );

    const [markets, setMarkets] = useState(INITIAL_MARKETS);
    const [loading, setLoading] = useState(true);
    const [marketError, setMarketError] = useState("");
    const [lastUpdated, setLastUpdated] = useState("");
    const [goldCity, setGoldCity] = useState("");

    const [selectedCategory, setSelectedCategory] =
        useState("Gold & Silver");

    const [news, setNews] = useState([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const [newsError, setNewsError] = useState("");
    const [newsRefresh, setNewsRefresh] = useState(0);

    // SAVE SELECTED CITY
    useEffect(() => {
        setUserData("budgetSelectedCity", city);
    }, [city]);

    // LOAD GOLD, SILVER AND CURRENCY
    useEffect(() => {
        let cancelled = false;

        async function loadMarkets() {
            setLoading(true);
            setMarketError("");
            setGoldCity("");
            setLastUpdated("");

            const updated = INITIAL_MARKETS.map(item => ({
                ...item
            }));

            const urls = [
                `/api/gold?city=${encodeURIComponent(city)}`,
                `${API}/silver/in/latest.json`,
                `${API}/fx/world/latest.json`
            ];

            const results = await Promise.allSettled(
                urls.map(url => getJSON(url))
            );

            if (cancelled) return;

            let successfulRequests = 0;
            const dates = [];

            // GOLD
            if (results[0].status === "fulfilled") {
                const data = results[0].value;

                if (data.success && data.prices) {
                    updated[0].value = formatINR(
                        data.prices.gold24k?.finalPricePerGram
                    );

                    updated[1].value = formatINR(
                        data.prices.gold22k?.finalPricePerGram
                    );

                    updated[2].value = formatINR(
                        data.prices.gold18k?.finalPricePerGram
                    );

                    if (
                        updated[0].value !== "Unavailable" &&
                        updated[1].value !== "Unavailable" &&
                        updated[2].value !== "Unavailable"
                    ) {
                        successfulRequests++;
                    }

                    setGoldCity(data.city || city);

                    if (data.timestamp) {
                        dates.push(data.timestamp);
                    }
                }
            }

            // SILVER
            if (results[1].status === "fulfilled") {
                const data = results[1].value;
                const silver = getObservation(data, "XAG");

                updated[3].value = formatINR(
                    silver?.value != null
                        ? Number(silver.value) / 1000
                        : null
                );

                if (silver) {
                    successfulRequests++;
                }

                if (data.generated_at) {
                    dates.push(data.generated_at);
                }
            }

            // USD / INR
            if (results[2].status === "fulfilled") {
                const data = results[2].value;
                const forex = getObservation(data, "USDINR");

                updated[4].value = forex?.value != null
                    ? Number(forex.value).toFixed(4)
                    : "Unavailable";

                if (forex) {
                    successfulRequests++;
                }

                if (data.generated_at) {
                    dates.push(data.generated_at);
                }
            }

            if (cancelled) return;

            setMarkets(updated);

            const validDates = dates
                .map(date => new Date(date))
                .filter(date => !Number.isNaN(date.getTime()));

            if (validDates.length > 0) {
                validDates.sort(
                    (a, b) => b.getTime() - a.getTime()
                );

                setLastUpdated(formatDate(validDates[0]));
            }

            if (successfulRequests === 0) {
                setMarketError(
                    "Market data could not be loaded. Please try again later."
                );
            } else if (successfulRequests < 3) {
                setMarketError(
                    "Some market information is temporarily unavailable."
                );
            }

            setLoading(false);
        }

        loadMarkets();

        return () => {
            cancelled = true;
        };
    }, [city]);

    // LOAD FINANCIAL NEWS
    useEffect(() => {
        let cancelled = false;

        async function loadNews() {
            setNewsLoading(true);
            setNewsError("");
            setNews([]);

            try {
                const data = await getJSON(
                    `/api/news?category=${encodeURIComponent(selectedCategory)}`
                );

                if (cancelled) return;

                if (
                    !data.success ||
                    !Array.isArray(data.articles)
                ) {
                    throw new Error("Invalid news response");
                }

                setNews(data.articles);

                if (data.articles.length === 0) {
                    setNewsError(
                        "No recent headlines found in this category."
                    );
                }

            } catch (error) {
                if (!cancelled) {
                    setNewsError(
                        "Unable to load financial news. Please try again."
                    );
                }
            } finally {
                if (!cancelled) {
                    setNewsLoading(false);
                }
            }
        }

        loadNews();

        return () => {
            cancelled = true;
        };
    }, [selectedCategory, newsRefresh]);

    return (
        <div className="financial-news-page">

            {/* PAGE HEADING */}
            <div className="market-heading">
                <div>
                    <h1>Financial News & Market Updates</h1>
                    <p>
                        Stay informed about financial markets,
                        gold prices and economic updates.
                    </p>
                </div>

                <span className="market-status">
                    Market Dashboard
                </span>
            </div>

            {/* CITY SELECTION */}
            <div className="city-selector">
                <div className="city-selector-info">
                    <span className="city-location-icon">📍</span>

                    <div>
                        <h3>Select Your City</h3>
                        <p>Selected city: {city}</p>
                    </div>
                </div>

                <select
                    id="fuel-city"
                    value={city}
                    onChange={event => setCity(event.target.value)}
                >
                    {CITIES.map(item => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </select>
            </div>

            {/* MARKET OVERVIEW */}
            <section className="market-section">

                <div className="market-section-heading">
                    <div>
                        <h2>Market Overview</h2>
                        <p>
                            Gold, silver and currency reference rates
                        </p>
                    </div>
                </div>

                <div className="market-grid">
                    {markets.map(item => (
                        <div
                            className="market-card"
                            key={item.title}
                        >
                            <div className="market-card-top">
                                <span>{item.title}</span>

                                <span className="market-icon">
                                    {item.icon}
                                </span>
                            </div>

                            <h2>{item.value}</h2>
                            <p>{item.unit}</p>
                        </div>
                    ))}
                </div>

                {goldCity && (
                    <p className="fuel-updated">
                        Gold rate location returned by provider: {goldCity}
                    </p>
                )}

                {loading && (
                    <p className="fuel-updated">
                        Fetching market information...
                    </p>
                )}

                {marketError && (
                    <p className="fuel-message fuel-error">
                        {marketError}
                    </p>
                )}

                {lastUpdated && (
                    <p className="fuel-updated">
                        Data updated: {lastUpdated}
                    </p>
                )}

                <p className="fuel-updated">
                    Gold: Nebula Metals API. Silver and currency:
                    SnapData reference data.
                </p>

            </section>

            {/* FINANCIAL NEWS */}
            <section className="market-section">

                <div className="market-section-heading">
                    <div>
                        <h2>Financial News</h2>
                        <p>
                            Latest financial headlines from India
                        </p>
                    </div>
                </div>

                {/* CATEGORY BUTTONS */}
                <div className="news-categories">
                    {NEWS_CATEGORIES.map(category => (
                        <button
                            key={category}
                            type="button"
                            className={
                                selectedCategory === category
                                    ? "active"
                                    : ""
                            }
                            aria-pressed={
                                selectedCategory === category
                            }
                            onClick={() =>
                                setSelectedCategory(category)
                            }
                        >
                            {category}
                        </button>
                    ))}
                </div>

                {/* NEWS LOADING */}
                {newsLoading && (
                    <div className="news-empty-state">
                        <div className="news-empty-icon">📰</div>

                        <h3>Loading Financial News...</h3>

                        <p>
                            Fetching the latest headlines for you.
                        </p>
                    </div>
                )}

                {/* NEWS ERROR */}
                {!newsLoading && newsError && (
                    <div className="news-empty-state">
                        <div className="news-empty-icon">📰</div>

                        <h3>News Temporarily Unavailable</h3>

                        <p>{newsError}</p>

                        <button
                            type="button"
                            onClick={() =>
                                setNewsRefresh(value => value + 1)
                            }
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* NEWS ARTICLES */}
                {!newsLoading &&
                    !newsError &&
                    news.length > 0 && (
                        <div className="news-list">

                            {news.map((article, index) => (
                                <article
                                    className="news-card"
                                    key={`${article.link}-${index}`}
                                >
                                    <div className="news-card-content">

                                        <span className="news-source">
                                            {article.source}
                                        </span>

                                        <h3>
                                            <a
                                                href={article.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {article.title}
                                            </a>
                                        </h3>

                                        <p className="news-date">
                                            {formatDate(
                                                article.publishedAt
                                            )}
                                        </p>

                                    </div>

                                    <span className="news-arrow">
                                        ↗
                                    </span>
                                </article>
                            ))}

                        </div>
                    )}

                <p className="fuel-updated">
                    Headlines provided through Google News RSS.
                    Articles belong to their respective publishers.
                </p>

            </section>

            {/* FUEL PRICES */}
            <section className="market-section">

                <div className="market-section-heading">
                    <div>
                        <h2>Fuel Price Updates</h2>

                        <p>
                            Petrol and diesel information for {city}
                        </p>
                    </div>
                </div>

                <div className="fuel-message">
                    City-wise petrol and diesel prices are not
                    connected yet.
                </div>

            </section>

            {/* DISCLAIMER */}
            <p className="market-disclaimer">
                Gold rates are indicative API prices and include
                3% GST. The provider may use national benchmark
                pricing for some locations rather than a separate
                city rate. Silver values are national benchmark
                references and exclude applicable taxes.
                Jewellery making charges, wastage and shop-level
                differences may apply. Financial news headlines
                are provided for general awareness only.
            </p>

        </div>
    );
}

export default FinancialNews;
