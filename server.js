const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const fs = require("node:fs/promises");
const path = require("node:path");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const pool = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL }
        : {
            host: process.env.PGHOST || "localhost",
            port: Number(process.env.PGPORT) || 5432,
            database: process.env.PGDATABASE || "blogdb",
            user: process.env.PGUSER || "postgres",
            password: process.env.PGPASSWORD
        }
);

if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set in production.");
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
    secret: process.env.SESSION_SECRET || "local-development-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000
    }
}));

app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    next();
});

function requireSignIn(req, res, next) {
    if (!req.session.user) {
        return res.redirect("/signin?message=Please%20sign%20in%20to%20continue.");
    }
    next();
}

function validPostFields({ title, body, category, postColor }) {
    return Boolean(
        title && title.trim() &&
        body && body.trim() &&
        ["Tech", "Music", "Education", "Other"].includes(category) &&
        ["DarkGreen", "Moss", "RosyBrown", "Midnight"].includes(postColor) &&
        title.trim().length <= 255
    );
}

function renderSignUp(res, { error = "", userId = "", name = "" } = {}) {
    res.status(error ? 400 : 200).render("signup", { error, userId, name });
}

function renderSignIn(res, { error = "", userId = "" } = {}) {
    res.status(error ? 400 : 200).render("signin", { error, userId });
}

app.get("/", async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `SELECT blog_id, creator_name, creator_user_id, title, body,
                    category, post_color, date_created
             FROM blogs
             ORDER BY date_created DESC, blog_id DESC`
        );
        res.render("index", { posts: rows });
    } catch (error) {
        next(error);
    }
});

app.get("/signup", (req, res) => renderSignUp(res));
app.get("/signin", (req, res) => {
    renderSignIn(res, { error: req.query.message || "" });
});

app.post("/signup", async (req, res, next) => {
    const userId = typeof req.body.user_id === "string" ? req.body.user_id.trim() : "";
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!userId || !name || !password || userId.length > 255 || name.length > 255 || password.length > 255) {
        return renderSignUp(res, { error: "Enter a user ID, name, and password (each no longer than 255 characters).", userId, name });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        await pool.query(
            "INSERT INTO users (user_id, password, name) VALUES ($1, $2, $3)",
            [userId, passwordHash, name]
        );
        res.redirect("/signin?message=Account%20created.%20Please%20sign%20in.");
    } catch (error) {
        if (error.code === "23505") {
            return renderSignUp(res, { error: "That user ID is already taken. Please choose another.", userId, name });
        }
        next(error);
    }
});

app.post("/signin", async (req, res, next) => {
    const userId = typeof req.body.user_id === "string" ? req.body.user_id.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    try {
        const { rows } = await pool.query(
            "SELECT user_id, password, name FROM users WHERE user_id = $1",
            [userId]
        );
        const user = rows[0];
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return renderSignIn(res, { error: "Incorrect user ID or password. Please try again.", userId });
        }

        req.session.regenerate((error) => {
            if (error) return next(error);
            req.session.user = { userId: user.user_id, name: user.name };
            req.session.save((saveError) => {
                if (saveError) return next(saveError);
                res.redirect("/");
            });
        });
    } catch (error) {
        next(error);
    }
});

app.post("/signout", (req, res, next) => {
    req.session.destroy((error) => {
        if (error) return next(error);
        res.clearCookie("connect.sid");
        res.redirect("/");
    });
});

app.post("/posts", requireSignIn, async (req, res, next) => {
    const { title, body, category, postColor } = req.body;
    if (!validPostFields({ title, body, category, postColor })) {
        return res.status(400).send("Please provide a title, body, category, and valid post color.");
    }

    try {
        await pool.query(
            `INSERT INTO blogs
                (creator_name, creator_user_id, title, body, category, post_color)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.session.user.name, req.session.user.userId, title.trim(), body.trim(), category, postColor]
        );
        res.redirect("/");
    } catch (error) {
        next(error);
    }
});

app.get("/posts/:id/edit", requireSignIn, async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            "SELECT * FROM blogs WHERE blog_id = $1 AND creator_user_id = $2",
            [req.params.id, req.session.user.userId]
        );
        if (!rows[0]) return res.status(404).send("Post not found or you do not have permission to edit it.");
        res.render("edit", { post: rows[0], error: "" });
    } catch (error) {
        next(error);
    }
});

app.post("/posts/:id/edit", requireSignIn, async (req, res, next) => {
    const { title, body, category, postColor } = req.body;
    if (!validPostFields({ title, body, category, postColor })) {
        return res.status(400).send("Please provide a title, body, category, and valid post color.");
    }

    try {
        const { rowCount } = await pool.query(
            `UPDATE blogs
             SET title = $1, body = $2, category = $3, post_color = $4
             WHERE blog_id = $5 AND creator_user_id = $6`,
            [title.trim(), body.trim(), category, postColor, req.params.id, req.session.user.userId]
        );
        if (!rowCount) return res.status(404).send("Post not found or you do not have permission to edit it.");
        res.redirect("/");
    } catch (error) {
        next(error);
    }
});

app.post("/posts/:id/delete", requireSignIn, async (req, res, next) => {
    try {
        const { rowCount } = await pool.query(
            "DELETE FROM blogs WHERE blog_id = $1 AND creator_user_id = $2",
            [req.params.id, req.session.user.userId]
        );
        if (!rowCount) return res.status(404).send("Post not found or you do not have permission to delete it.");
        res.redirect("/");
    } catch (error) {
        next(error);
    }
});

app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) return next(error);
    res.status(500).send("An unexpected server error occurred. Please try again later.");
});

async function start() {
    const schema = await fs.readFile(path.join(__dirname, "db", "schema.sql"), "utf8");
    await pool.query(schema);
    app.listen(PORT, () => {
        console.log(`Blog running at http://localhost:${PORT}`);
    });
}

start().catch((error) => {
    console.error("Could not start the Blog application. Check the PostgreSQL connection and database setup.", error);
    process.exitCode = 1;
});
