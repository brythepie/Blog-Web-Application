const express = require("express");

const app = express();
const PORT = 3000;

const posts = [];
let nextPostId = 1;

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.render("index", { posts });
});

app.post("/posts", (req, res) => {
    const {
        title,
        author,
        contents,
        category,
        postColor
    } = req.body;

    if (!title || !author || !contents || !category || !postColor) {
        return res.status(400).send("Please complete all fields.");
    }

    posts.unshift({
        id: nextPostId++,
        title,
        author,
        contents,
        category,
        postColor,
        createdAt: new Date()
    });

    res.redirect("/");
});

app.post("/posts/:id/edit", (req, res) => {
    const post = posts.find((item) => item.id === Number(req.params.id));
    const {
        title,
        author,
        contents,
        category,
        postColor
    } = req.body;

    if (!post) {
        return res.status(404).send("Post not found.");
    }

    if (!title || !author || !contents || !category || !postColor) {
        return res.status(400).send("Please complete all fields.");
    }

    post.title = title;
    post.author = author;
    post.contents = contents;
    post.category = category;
    post.postColor = postColor;

    res.redirect("/");
});

app.post("/posts/:id/delete", (req, res) => {
    const postIndex = posts.findIndex(
        (item) => item.id === Number(req.params.id)
    );

    if (postIndex === -1) {
        return res.status(404).send("Post not found.");
    }

    posts.splice(postIndex, 1);
    res.redirect("/");
});

app.listen(PORT, () => {
    console.log(`Blog running at http://localhost:${PORT}`);
});