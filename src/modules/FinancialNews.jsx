
import { useEffect, useState } from "react";
import { getUserData, setUserData } from "../utils/storage";
import "../styles/FinancialNews.css";

const CITIES = [
    "Vijayawada", "Guntur", "Visakhapatnam", "Tirupati",
    "Hyderabad", "Bengaluru", "Chennai", "Mumbai",
    "Delhi", "Kolkata", "Pune", "Kochi"
];

const API = "https://snapdata.dev/api/v1";

const INITIAL_MARKETS = [
    { title: "24K Gold", value: "Loading...", unit: "₹ / gram · GST included", icon: "🥇" },
    { title: "22K Gold", value: "Loading...", unit: "₹ / gram · GST included", icon: "💛" },
    { title: "18K Gold", value: "Loading...", unit: "₹ / gram · GST included", icon: "✨" },
    { title: "Silver", value: "Loading...", unit: "₹ / gram · National benchmark", icon: "🥈" },
    { title: "USD / INR", value: "Loading...", unit: "ECB reference rate", icon: "💱" }
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

    if (Number.isNaN(parsedDate.getTime())) return "";

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

    useEffect(() => {
        setUserData("budgetSelectedCity", city);
    }, [city]);

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

            try {
                const results = await Promise.allSettled(
                    urls.map(url => getJSON(url))
                );

                if (cancelled) return;

                let successfulRequests = 0;
                const dates = [];

                // CITY GOLD RATES - NEBULA
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

                // SILVER - SNAPDATA
                if (results[1].status === "fulfilled") {
                    const data = results[1].value;
                    const silver = getObservation(data, "XAG");

                    updated[3].value = formatINR(
                        silver?.value != null
                            ? Number(silver.value) / 1000
                            : null
                    );

                    if (silver) successfulRequests++;

                    if (data.generated_at) {
                        dates.push(data.generated_at);
                    }
                }

                // USD / INR - SNAPDATA
                if (results[2].status === "fulfilled") {
                    const data = results[2].value;
                    const forex = getObservation(data, "USDINR");

                    updated[4].value = forex?.value != null
                        ? Number(forex.value).toFixed(4)
                        : "Unavailable";

                    if (forex) successfulRequests++;

                    if (data.generated_at) {
                        dates.push(data.generated_at);
                    }
                }

                if (cancelled) return;

                setMarkets(updated);

                if (dates.length > 0) {
                    const latestDate = dates
                        .map(date => new Date(date))
                        .filter(date => !Number.isNaN(date.getTime()))
                        .sort((a, b) => b.getTime() - a.getTime())[0];

                    if (latestDate) {
                        setLastUpdated(formatDate(latestDate));
                    }
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

            } catch (error) {
                if (!cancelled) {
                    setMarketError(
                        "Unable to connect to market data."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadMarkets();

        return () => {
            cancelled = true;
        };
    }, [city]);

    const newsCategories = [
        "Gold & Silver",
        "Stock Market",
        "Banking & RBI",
        "Economy",
        "Currency"
    ];

    return (
        <div className="financial-news-page">

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
                        <div className="market-card" key={item.title}>
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
                            Financial updates and important headlines
                        </p>
                    </div>
                </div>

                <div className="news-categories">
                    {newsCategories.map(category => (
                        <button key={category} type="button">
                            {category}
                        </button>
                    ))}
                </div>

                <div className="news-empty-state">
                    <div className="news-empty-icon">📰</div>

                    <h3>News Feed Not Connected</h3>

                    <p>
                        A verified financial news provider has not
                        been connected yet.
                    </p>
                </div>

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

            <p className="market-disclaimer">
                Gold rates are indicative API prices and include
                3% GST. The provider may use national benchmark
                pricing for some locations rather than a separate
                city rate. Silver values are national benchmark
                references and exclude applicable taxes.
                Jewellery making charges, wastage and shop-level
                differences may apply. Market information is for
                general awareness only.
            </p>

        </div>
    );
}

export default FinancialNews;
