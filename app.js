const form = document.getElementById("creationform");
const toggleFormButton = document.getElementById("toggleForm");
const contentsBox = document.getElementById("contents");
const categoryButtons = document.querySelectorAll("#category-nav button");

form.style.display = "none";

toggleFormButton.addEventListener("click", () => {
    const isHidden = form.style.display === "none";

    form.style.display = isHidden ? "block" : "none";
    toggleFormButton.textContent = isHidden
        ? "Close Form"
        : "Create Post";
});

contentsBox.addEventListener("input", () => {
    contentsBox.style.height = "auto";
    contentsBox.style.height = `${contentsBox.scrollHeight}px`;
});

categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const selectedCategory = button.dataset.category;

        categoryButtons.forEach((item) => {
            item.classList.remove("active");
        });

        button.classList.add("active");

        document.querySelectorAll(".post").forEach((post) => {
            const shouldShow =
                selectedCategory === "All" ||
                post.dataset.category === selectedCategory;

            post.style.display = shouldShow ? "block" : "none";
        });
    });
});

document.querySelectorAll(".post").forEach((post) => {
    post.addEventListener("click", (event) => {
        if (event.target.closest("button, form, input, textarea, select")) {
            return;
        }

        post.classList.toggle("open");
    });

    const editButton = post.querySelector(".edit-post");
    const cancelButton = post.querySelector(".cancel-edit");
    const editForm = post.querySelector(".edit-form");

    editButton.addEventListener("click", (event) => {
        event.stopPropagation();
        editForm.classList.add("visible");
    });

    cancelButton.addEventListener("click", (event) => {
        event.stopPropagation();
        editForm.classList.remove("visible");
    });
});