
import { useState } from "react";
import "../styles/TransactionHistory.css";

function TransactionHistory() {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("All");

    const incomes = JSON.parse(
        localStorage.getItem("budgetIncomes") || "[]"
    );

    const expenses = JSON.parse(
        localStorage.getItem("budgetExpenses") || "[]"
    );

    const transactions = [
        ...incomes.map(item => ({
            id: `income-${item.id}`,
            title: item.source || item.title || "Income",
            category: item.category || "Income",
            amount: Number(item.amount),
            date: item.date,
            type: "Income"
        })),

        ...expenses.map(item => ({
            id: `expense-${item.id}`,
            title: item.title || "Expense",
            category: item.category || "Other",
            amount: Number(item.amount),
            date: item.date,
            type: "Expense"
        }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalIncome = incomes.reduce(
        (total, item) => total + Number(item.amount), 0
    );

    const totalExpenses = expenses.reduce(
        (total, item) => total + Number(item.amount), 0
    );

    const filteredTransactions = transactions.filter(item => {
        const matchesSearch =
            item.title.toLowerCase().includes(search.toLowerCase()) ||
            item.category.toLowerCase().includes(search.toLowerCase());

        const matchesFilter =
            filter === "All" || item.type === filter;

        return matchesSearch && matchesFilter;
    });

    return (
        <div className="transaction-page">

            <div className="transaction-heading">
                <p className="transaction-label">FINANCIAL MANAGEMENT</p>
                <h1>Transaction History</h1>
                <p>View and track all your income and expenses in one place.</p>
            </div>

            <div className="transaction-summary">

                <div className="transaction-summary-card">
                    <span>Total Income</span>
                    <h2 className="transaction-income">
                        ₹{totalIncome.toLocaleString("en-IN")}
                    </h2>
                </div>

                <div className="transaction-summary-card">
                    <span>Total Expenses</span>
                    <h2 className="transaction-expense">
                        ₹{totalExpenses.toLocaleString("en-IN")}
                    </h2>
                </div>

                <div className="transaction-summary-card">
                    <span>Net Balance</span>
                    <h2 className="transaction-balance">
                        ₹{(totalIncome - totalExpenses).toLocaleString("en-IN")}
                    </h2>
                </div>

                <div className="transaction-summary-card">
                    <span>Total Transactions</span>
                    <h2>{transactions.length}</h2>
                </div>

            </div>

            <div className="transaction-list-card">

                <div className="transaction-list-heading">
                    <div>
                        <h2>All Transactions</h2>
                        <p>Your complete financial activity</p>
                    </div>
                </div>

                <div className="transaction-controls">

                    <input
                        type="text"
                        placeholder="Search transactions..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />

                    <select
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    >
                        <option value="All">All Transactions</option>
                        <option value="Income">Income Only</option>
                        <option value="Expense">Expenses Only</option>
                    </select>

                </div>

                {filteredTransactions.length === 0 ? (

                    <div className="transaction-empty">
                        <span>📋</span>
                        <h3>No transactions found</h3>
                        <p>
                            Add income or expenses to view your transaction history.
                        </p>
                    </div>

                ) : (

                    <div className="transaction-table-wrapper">
                        <table className="transaction-table">

                            <thead>
                                <tr>
                                    <th>Transaction</th>
                                    <th>Category</th>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredTransactions.map(item => (

                                    <tr key={item.id}>
                                        <td>{item.title}</td>
                                        <td>{item.category}</td>
                                        <td>{item.date}</td>

                                        <td>
                                            <span className={`transaction-type ${item.type.toLowerCase()}`}>
                                                {item.type}
                                            </span>
                                        </td>

                                        <td className={item.type === "Income" ? "transaction-income" : "transaction-expense"}>
                                            {item.type === "Income" ? "+" : "-"}
                                            ₹{item.amount.toLocaleString("en-IN")}
                                        </td>
                                    </tr>

                                ))}
                            </tbody>

                        </table>
                    </div>

                )}

            </div>

        </div>
    );
}

export default TransactionHistory;
