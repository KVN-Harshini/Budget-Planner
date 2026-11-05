
import { useEffect, useMemo, useState } from "react";
import "../styles/BudgetSavings.css";

const readStorage = (key, fallback) => {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
        return fallback;
    }
};

const money = (amount) =>
    Number(amount || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 0
    });

const getCategoryName = (item) => {
    if (typeof item === "string") return item;

    return (
        item?.name ||
        item?.categoryName ||
        item?.category ||
        item?.title ||
        ""
    );
};

function BudgetSavings() {
    const savedPlan = readStorage("budgetMonthlyPlan", {});
    const savedGoals = readStorage("budgetSavingsGoals", []);
    const savedCategories = readStorage("budgetCategories", []);

    const [income, setIncome] = useState(
        savedPlan.income ? String(savedPlan.income) : ""
    );

    const [hasGoals, setHasGoals] = useState(
        savedPlan.hasGoals ?? savedGoals.length > 0
    );

    const [categories, setCategories] = useState(() => {
        const names = savedCategories
            .map(getCategoryName)
            .filter(Boolean);

        return [...new Set(names)];
    });

    const [allocations, setAllocations] = useState(
        savedPlan.allocations || {}
    );

    // Support previously saved goals
    const [goals, setGoals] = useState(() =>
        savedGoals.map((goal) => ({
            ...goal,
            monthlySaving: Number(goal.monthlySaving || 0)
        }))
    );

    const [goalName, setGoalName] = useState("");
    const [goalAmount, setGoalAmount] = useState("");
    const [goalMonthlySaving, setGoalMonthlySaving] = useState("");

    const [planGenerated, setPlanGenerated] = useState(
        Boolean(savedPlan.generated)
    );

    const [message, setMessage] = useState("");

    // Update categories when Expense Categories changes
    useEffect(() => {
        const updateCategories = () => {
            const stored = readStorage("budgetCategories", []);

            const names = [
                ...new Set(
                    stored.map(getCategoryName).filter(Boolean)
                )
            ];

            setCategories(names);

            setAllocations((previous) => {
                const updated = { ...previous };

                names.forEach((name) => {
                    if (updated[name] === undefined) {
                        updated[name] = 0;
                    }
                });

                Object.keys(updated).forEach((name) => {
                    if (!names.includes(name)) {
                        delete updated[name];
                    }
                });

                return updated;
            });
        };

        window.addEventListener(
            "budgetCategoriesUpdated",
            updateCategories
        );

        return () => {
            window.removeEventListener(
                "budgetCategoriesUpdated",
                updateCategories
            );
        };
    }, []);

    // Save purchase goals
    useEffect(() => {
        localStorage.setItem(
            "budgetSavingsGoals",
            JSON.stringify(goals)
        );
    }, [goals]);

    const salary = Number(income) || 0;

    // Calculate estimated completion months for every goal
    const goalDetails = useMemo(() => {
        return goals.map((goal) => {
            const target = Number(goal.targetAmount || 0);
            const monthlySaving = Number(goal.monthlySaving || 0);

            const months = monthlySaving > 0
                ? Math.ceil(target / monthlySaving)
                : null;

            return {
                ...goal,
                target,
                monthlySaving,
                months
            };
        });
    }, [goals]);

    // Total monthly savings for all goals
    const totalGoalSavings = goalDetails.reduce(
        (sum, goal) => sum + goal.monthlySaving,
        0
    );

    // Remaining salary after goal savings
    const availableAfterGoals = Math.max(
        0,
        salary - (hasGoals ? totalGoalSavings : 0)
    );

    // Without goals, reserve 20% for general savings
    const generalSavings = hasGoals ? 0 : salary * 0.2;

    const categoryBudgetPool = hasGoals
        ? availableAfterGoals
        : salary * 0.8;

    // Category allocation calculations
    const categoryPercentageTotal = categories.reduce(
        (sum, category) =>
            sum + Number(allocations[category] || 0),
        0
    );

    const categoryBudgetTotal =
        categoryBudgetPool * categoryPercentageTotal / 100;

    const unallocatedAmount = Math.max(
        0,
        categoryBudgetPool - categoryBudgetTotal
    );

    const categoryRows = categories.map((category) => {
        const percentage = Number(allocations[category] || 0);

        return {
            name: category,
            percentage,
            amount: categoryBudgetPool * percentage / 100
        };
    });

    // Add a purchase goal
    function addGoal(event) {
        event.preventDefault();

        if (!goalName.trim()) {
            setMessage("Please enter the purchase name.");
            return;
        }

        if (Number(goalAmount) <= 0) {
            setMessage("Please enter a valid purchase amount.");
            return;
        }

        if (Number(goalMonthlySaving) <= 0) {
            setMessage("Please enter a valid monthly saving amount.");
            return;
        }

        const newGoal = {
            id: Date.now(),
            name: goalName.trim(),
            targetAmount: Number(goalAmount),
            monthlySaving: Number(goalMonthlySaving)
        };

        setGoals((previous) => [...previous, newGoal]);

        setGoalName("");
        setGoalAmount("");
        setGoalMonthlySaving("");
        setMessage("Purchase goal added successfully!");
        setPlanGenerated(false);
    }

    // Edit monthly saving amount for an individual goal
    function updateGoalSaving(id, value) {
        const amount = Math.max(0, Number(value) || 0);

        setGoals((previous) =>
            previous.map((goal) =>
                goal.id === id
                    ? { ...goal, monthlySaving: amount }
                    : goal
            )
        );

        setPlanGenerated(false);
    }

    // Delete a purchase goal
    function deleteGoal(id) {
        setGoals((previous) =>
            previous.filter((goal) => goal.id !== id)
        );

        setPlanGenerated(false);
    }

    // Update category allocation
    function updateAllocation(category, value) {
        const percentage = Math.max(
            0,
            Math.min(100, Number(value) || 0)
        );

        setAllocations((previous) => ({
            ...previous,
            [category]: percentage
        }));

        setPlanGenerated(false);
    }

    // Generate the budget
    function generatePlan() {
        if (salary <= 0) {
            setMessage("Please enter your monthly salary.");
            return;
        }

        if (hasGoals && goals.length === 0) {
            setMessage("Please add at least one purchase goal.");
            return;
        }

        if (hasGoals && goalDetails.some(
            (goal) => goal.monthlySaving <= 0
        )) {
            setMessage(
                "Enter a monthly saving amount for every purchase goal."
            );
            return;
        }

        if (totalGoalSavings > salary) {
            setMessage(
                "Your total monthly goal savings exceed your salary. Reduce the amounts."
            );
            return;
        }

        if (categoryPercentageTotal > 100) {
            setMessage(
                "Category allocation percentage cannot exceed 100%."
            );
            return;
        }

        const plan = {
            income: salary,
            hasGoals,
            allocations,
            generated: true,
            generatedAt: new Date().toISOString()
        };

        localStorage.setItem(
            "budgetMonthlyPlan",
            JSON.stringify(plan)
        );

        setPlanGenerated(true);
        setMessage("Your smart budget plan has been generated!");
    }

    function changeGoalChoice(value) {
        setHasGoals(value);
        setPlanGenerated(false);
        setMessage("");

        if (!value) {
            setGoals([]);
        }
    }

    return (
        <div className="budget-planner">

            <div className="budget-header">
                <p className="budget-label">SMART FINANCIAL PLANNING</p>
                <h1>Smart Budget & Savings Planner</h1>
                <p>
                    Plan your monthly expenses and achieve your
                    purchase goals with a personalized budget.
                </p>
            </div>

            {/* STEP 1: SALARY */}
            <section className="budget-card">
                <div className="step-heading">
                    <span className="step-number">1</span>
                    <div>
                        <h2>Enter Your Monthly Salary</h2>
                        <p>Enter your monthly income to start planning.</p>
                    </div>
                </div>

                <div className="salary-input">
                    <label>Monthly Salary (₹)</label>
                    <input
                        type="number"
                        min="1"
                        placeholder="Example: 40000"
                        value={income}
                        onChange={(event) => {
                            setIncome(event.target.value);
                            setPlanGenerated(false);
                        }}
                    />
                </div>
            </section>

            {/* STEP 2: PURCHASE GOALS */}
            <section className="budget-card">
                <div className="step-heading">
                    <span className="step-number">2</span>
                    <div>
                        <h2>Do You Have Any Purchase Goals?</h2>
                        <p>
                            Tell us what you want to purchase.
                            You can add multiple goals.
                        </p>
                    </div>
                </div>

                <div className="goal-choice">
                    <button
                        type="button"
                        className={
                            hasGoals ? "choice-button selected" : "choice-button"
                        }
                        onClick={() => changeGoalChoice(true)}
                    >
                        Yes, I have goals
                    </button>

                    <button
                        type="button"
                        className={
                            !hasGoals ? "choice-button selected" : "choice-button"
                        }
                        onClick={() => changeGoalChoice(false)}
                    >
                        No, not right now
                    </button>
                </div>

                {!hasGoals && (
                    <div className="normal-plan-message">
                        <h3>Normal Budget Planning</h3>
                        <p>
                            No purchase goals selected. Your expense
                            categories will be planned using 80% of
                            your salary, with 20% reserved for general savings.
                        </p>
                    </div>
                )}

                {hasGoals && (
                    <>
                        <form className="goal-form" onSubmit={addGoal}>
                            <h3>Add a Purchase Goal</h3>

                            <div className="goal-form-grid">
                                <div>
                                    <label>Purchase Name</label>
                                    <input
                                        type="text"
                                        placeholder="Example: Laptop"
                                        value={goalName}
                                        onChange={(event) =>
                                            setGoalName(event.target.value)
                                        }
                                    />
                                </div>

                                <div>
                                    <label>Purchase Amount (₹)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="Example: 60000"
                                        value={goalAmount}
                                        onChange={(event) =>
                                            setGoalAmount(event.target.value)
                                        }
                                    />
                                </div>

                                <div>
                                    <label>How Much Can You Save Monthly? (₹)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="Example: 5000"
                                        value={goalMonthlySaving}
                                        onChange={(event) =>
                                            setGoalMonthlySaving(event.target.value)
                                        }
                                    />
                                </div>
                            </div>

                            <button type="submit" className="secondary-button">
                                + Add Goal
                            </button>
                        </form>

                        {goalDetails.length > 0 && (
                            <div className="goals-list">
                                <h3>Your Purchase Goals</h3>

                                {goalDetails.map((goal) => (
                                    <div className="goal-item" key={goal.id}>
                                        <div className="goal-item-details">
                                            <strong>{goal.name}</strong>

                                            <p>
                                                Purchase amount: ₹{money(goal.target)}
                                            </p>

                                            <label>
                                                Monthly Saving Amount (₹)
                                            </label>

                                            <input
                                                type="number"
                                                min="0"
                                                value={goal.monthlySaving}
                                                onChange={(event) =>
                                                    updateGoalSaving(
                                                        goal.id,
                                                        event.target.value
                                                    )
                                                }
                                            />

                                            {goal.months !== null ? (
                                                <p className="goal-monthly">
                                                    You can purchase this in
                                                    approximately {goal.months}
                                                    {" "}
                                                    {goal.months === 1 ? "month" : "months"}.
                                                </p>
                                            ) : (
                                                <p className="budget-warning">
                                                    Enter a monthly saving amount
                                                    to calculate the estimated time.
                                                </p>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            className="delete-goal"
                                            onClick={() => deleteGoal(goal.id)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* STEP 3: CATEGORY PLANNING */}
            <section className="budget-card">
                <div className="step-heading">
                    <span className="step-number">3</span>
                    <div>
                        <h2>Plan Your Expense Categories</h2>
                        <p>
                            Your remaining salary will be allocated
                            across your existing expense categories.
                        </p>
                    </div>
                </div>

                <div className="category-pool">
                    <span>Available for category planning</span>
                    <strong>₹{money(categoryBudgetPool)}</strong>
                </div>

                {categories.length > 0 ? (
                    <>
                        <div className="allocation-heading">
                            <span>Expense Category</span>
                            <span>Allocation (%)</span>
                            <span>Monthly Budget</span>
                        </div>

                        {categoryRows.map((item) => (
                            <div className="allocation-row" key={item.name}>
                                <strong>{item.name}</strong>

                                <div className="allocation-controls">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={item.percentage}
                                        onChange={(event) =>
                                            updateAllocation(
                                                item.name,
                                                event.target.value
                                            )
                                        }
                                    />
                                    <span>%</span>
                                </div>

                                <strong>₹{money(item.amount)}</strong>
                            </div>
                        ))}

                        <div className="allocation-total">
                            <span>
                                Total category allocation:
                                {" "}{categoryPercentageTotal}%
                            </span>
                            <strong>₹{money(categoryBudgetTotal)}</strong>
                        </div>

                        <div className="unallocated-info">
                            Remaining unallocated amount:
                            {" "}₹{money(unallocatedAmount)}
                        </div>

                        {categoryPercentageTotal > 100 && (
                            <p className="budget-warning">
                                Category allocation exceeds 100%.
                                Please adjust the percentages.
                            </p>
                        )}
                    </>
                ) : (
                    <div className="empty-goals">
                        No expense categories found. Add categories
                        in Expense Categories first.
                    </div>
                )}
            </section>

            {/* STEP 4: SUMMARY */}
            <section className="budget-card">
                <div className="step-heading">
                    <span className="step-number">4</span>
                    <div>
                        <h2>Your Budget Summary</h2>
                        <p>Review your monthly financial plan.</p>
                    </div>
                </div>

                <div className="budget-summary-grid">
                    <div className="summary-card">
                        <span>Monthly Salary</span>
                        <strong>₹{money(salary)}</strong>
                    </div>

                    <div className="summary-card">
                        <span>Monthly Goal Savings</span>
                        <strong>
                            ₹{money(hasGoals ? totalGoalSavings : 0)}
                        </strong>
                    </div>

                    <div className="summary-card">
                        <span>Category Budget</span>
                        <strong>₹{money(categoryBudgetTotal)}</strong>
                    </div>

                    <div className="summary-card">
                        <span>General Savings</span>
                        <strong>₹{money(generalSavings)}</strong>
                    </div>
                </div>

                {hasGoals && goals.length > 0 && (
                    <div className="goal-plan-message">
                        <h3>Purchase Goal Summary</h3>

                        {totalGoalSavings > salary ? (
                            <p className="budget-warning">
                                Your goals require ₹{money(totalGoalSavings)}
                                {" "}per month, which is more than your salary.
                                Reduce the monthly savings amounts to create
                                a feasible budget.
                            </p>
                        ) : (
                            <p className="budget-success">
                                Your selected monthly savings fit within
                                your salary. ₹{money(availableAfterGoals)}
                                {" "}is available for expense categories.
                            </p>
                        )}

                        <div className="goal-summary-list">
                            {goalDetails.map((goal) => (
                                <div key={goal.id}>
                                    <span>{goal.name}</span>
                                    <strong>
                                        {goal.months === null
                                            ? "Not calculated"
                                            : `Approximately ${goal.months} months`}
                                    </strong>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    type="button"
                    className="primary-button"
                    onClick={generatePlan}
                >
                    Generate My Budget Plan
                </button>

                {message && (
                    <p className="budget-message">{message}</p>
                )}

                {planGenerated && (
                    <div className="budget-success">
                        Your monthly budget plan has been saved successfully!
                    </div>
                )}
            </section>

            <p className="budget-disclaimer">
                Note: Completion time is an estimate based on the monthly
                saving amount entered by you. This planner does not
                automatically transfer money or record bank transactions.
            </p>

        </div>
    );
}

export default BudgetSavings;
