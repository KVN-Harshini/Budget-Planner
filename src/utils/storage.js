const USERS_KEY = "budgetPlannerUsers";
const CURRENT_USER_KEY = "budgetPlannerCurrentUser";

const ADMIN_EMAIL = "admin@budgetplanner.com";
const ADMIN_PASSWORD = "Admin@123";

// Generate a unique ID for every account
function generateUserId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return "user_" + Date.now() + "_" + Math.random().toString(36).slice(2);
}

// Get all users and ensure every account has a User ID
export function getUsers() {
    let users = [];

    try {
        users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];

        if (!Array.isArray(users)) {
            users = [];
        }
    } catch {
        users = [];
    }

    let changed = false;

    users = users.map(user => {
        if (user.userId) {
            return user;
        }

        changed = true;

        return {
            ...user,
            userId: generateUserId()
        };
    });

    const adminExists = users.some(
        user => user.role === "admin"
    );

    if (!adminExists) {
        users.push({
            userId: generateUserId(),
            name: "Admin",
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            role: "admin",
            isActive: true
        });

        changed = true;
    }

    if (changed) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    return users;
}

// Register a new User
export function registerUser(user) {
    const users = getUsers();

    const email = user.email.trim().toLowerCase();

    const existingUser = users.find(
        u => u.email?.toLowerCase() === email
    );

    if (existingUser) {
        return {
            success: false,
            message: "Email already registered!"
        };
    }

    const newUser = {
        userId: generateUserId(),
        name: user.name.trim(),
        email,
        password: user.password,
        role: "user",
        isActive: true
    };

    users.push(newUser);

    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    return {
        success: true,
        message: "Registration successful!"
    };
}

// Login User or Admin
export function loginUser(email, password) {
    const users = getUsers();

    const normalizedEmail = email.trim().toLowerCase();

    const user = users.find(
        u =>
            u.email?.toLowerCase() === normalizedEmail &&
            u.password === password
    );

    if (!user) {
        return {
            success: false,
            message: "Invalid email or password!"
        };
    }

    if (user.isActive === false) {
        return {
            success: false,
            message: "Your account has been deactivated. Contact Admin."
        };
    }

    const loggedUser = {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role || "user",
        isActive: user.isActive !== false
    };

    localStorage.setItem(
        CURRENT_USER_KEY,
        JSON.stringify(loggedUser)
    );

    return {
        success: true,
        user: loggedUser
    };
}

// Get currently logged-in user
export function getCurrentUser() {
    try {
        const savedUser = JSON.parse(
            localStorage.getItem(CURRENT_USER_KEY)
        );

        if (!savedUser) {
            return null;
        }

        // Match the current session with the registered account
        const users = getUsers();

        const registeredUser = users.find(
            user =>
                user.email?.toLowerCase() === savedUser.email?.toLowerCase()
        );

        if (!registeredUser) {
            return savedUser;
        }

        const currentUser = {
            userId: registeredUser.userId,
            name: registeredUser.name,
            email: registeredUser.email,
            role: registeredUser.role || "user",
            isActive: registeredUser.isActive !== false
        };

        localStorage.setItem(
            CURRENT_USER_KEY,
            JSON.stringify(currentUser)
        );

        return currentUser;
    } catch {
        return null;
    }
}

// Create a separate Local Storage key for each user's data
export function getUserStorageKey(dataKey, user = getCurrentUser()) {
    if (!user || !user.userId) {
        return null;
    }

    return `budgetPlannerUserData_${encodeURIComponent(user.userId)}_${dataKey}`;
}

// Read data belonging only to the currently logged-in user
export function getUserData(dataKey, defaultValue = []) {
    const storageKey = getUserStorageKey(dataKey);

    if (!storageKey) {
        return defaultValue;
    }

    try {
        const savedData = localStorage.getItem(storageKey);

        return savedData === null
            ? defaultValue
            : JSON.parse(savedData);
    } catch {
        return defaultValue;
    }
}

// Save data belonging only to the currently logged-in user
export function setUserData(dataKey, value) {
    const storageKey = getUserStorageKey(dataKey);

    if (!storageKey) {
        return false;
    }

    try {
        localStorage.setItem(
            storageKey,
            JSON.stringify(value)
        );

        return true;
    } catch {
        return false;
    }
}

// Remove one user's specific data
export function removeUserData(dataKey) {
    const storageKey = getUserStorageKey(dataKey);

    if (!storageKey) {
        return false;
    }

    localStorage.removeItem(storageKey);
    return true;
}

// Update Admin email and password
export function updateAdminCredentials({
    currentPassword,
    newEmail,
    newPassword
}) {
    const users = getUsers();
    const currentUser = getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
        return {
            success: false,
            message: "Only Admin can update these credentials."
        };
    }

    const admin = users.find(
        user =>
            user.userId === currentUser.userId &&
            user.role === "admin"
    );

    if (!admin) {
        return {
            success: false,
            message: "Admin account not found."
        };
    }

    if (admin.password !== currentPassword) {
        return {
            success: false,
            message: "Current password is incorrect."
        };
    }

    const email = newEmail.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return {
            success: false,
            message: "Please enter a valid email address."
        };
    }

    const duplicateEmail = users.find(
        user =>
            user.email?.toLowerCase() === email &&
            user.userId !== admin.userId
    );

    if (duplicateEmail) {
        return {
            success: false,
            message: "This email is already used by another account."
        };
    }

    if (newPassword && newPassword.length < 8) {
        return {
            success: false,
            message: "New password must contain at least 8 characters."
        };
    }

    const updatedUsers = users.map(user => {
        if (user.userId === admin.userId) {
            return {
                ...user,
                email,
                password: newPassword || user.password
            };
        }

        return user;
    });

    localStorage.setItem(
        USERS_KEY,
        JSON.stringify(updatedUsers)
    );

    const updatedAdmin = updatedUsers.find(
        user => user.userId === admin.userId
    );

    const loggedUser = {
        userId: updatedAdmin.userId,
        name: updatedAdmin.name,
        email: updatedAdmin.email,
        role: "admin",
        isActive: updatedAdmin.isActive !== false
    };

    localStorage.setItem(
        CURRENT_USER_KEY,
        JSON.stringify(loggedUser)
    );

    return {
        success: true,
        message: "Admin credentials updated successfully!",
        user: loggedUser
    };
}

// Logout
export function logoutUser() {
    localStorage.removeItem(CURRENT_USER_KEY);
}