const fs = require("fs");
const path = require("path");
const xml2js = require("xml2js");

const sitemapPath = path.join(__dirname, "..", "..", "public", "sitemap.xml");
const baseDir = path.join(__dirname, "..", "blog");
// TODO: remove the hardcoded features here
const features = [
    "FASHION",
    "BODY",
    "FACE_SWAP",
    "AVATAR",
    "PHOTO",
    "ENHANCE",
    "TATTOO",
    "FACE_RETOUCH",
    "COPY_CLOTHES",
    "IMAGE",
];

function getLocalesFromDirectories(baseDir) {
    const locales = [];
    const directories = fs.readdirSync(baseDir, { withFileTypes: true });

    directories.forEach((dir) => {
        if (dir.isDirectory()) {
            const blogPath = path.join(baseDir, dir.name, "blog");
            if (
                fs.existsSync(blogPath) &&
                fs.statSync(blogPath).isDirectory()
            ) {
                locales.push(dir.name);
            }
        }
    });

    return locales;
}

function getBlogPosts(baseDir, locale) {
    const postsPath = path.join(baseDir, locale, "blog");
    const posts = [];

    if (fs.existsSync(postsPath) && fs.statSync(postsPath).isDirectory()) {
        const postDirs = fs.readdirSync(postsPath, { withFileTypes: true });

        postDirs.forEach((postDir) => {
            if (postDir.isDirectory()) {
                const postSlug = postDir.name;
                const postPath = path.join(postsPath, postSlug, "index.md");
                const postContent = fs.readFileSync(postPath, "utf8");
                const headerMatch = postContent.match(/^---\n([\s\S]*?)\n---/);
                const headerContent = headerMatch ? headerMatch[1] : "";

                const metadata = {};
                headerContent.split("\n").forEach((line) => {
                    const [key, ...valueParts] = line.split(":");
                    if (key && valueParts.length) {
                        metadata[key.trim()] = valueParts
                            .join(":")
                            .trim()
                            .replace(/^"(.*)"$/, "$1");
                    }
                });

                const url = `${process.env.NEXT_PUBLIC_WEB_URL}/${locale}/blog/${postSlug}/`;
                posts.push({ url, ...metadata });
            }
        });
    }

    return posts;
}

function createNewSitemap(locales) {
    const urlset = {
        urlset: {
            $: { xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9" },
            url: [],
        },
    };

    // Создаем новую карту сайта, добавляя URL блога
    locales.forEach((locale) => {
        // Получаем URL всех постов блога для данной локали
        const pages = getBlogPosts(baseDir, locale);

        const blogLastmod = pages
            .map((post) => post.date ?? new Date().toISOString().split("T")[0]) // Map to an array of date strings
            .sort() // Sort dates lexicographically (ISO 8601 format is sortable)
            .pop(); // Get the last (latest) date

        // Основной URL блога для локали
        urlset.urlset.url.push({
            loc: [`${process.env.NEXT_PUBLIC_WEB_URL}/${locale}/blog`],
            lastmod: [blogLastmod],
            changefreq: ["monthly"],
            priority: [0.9],
        });

        pages.forEach((post) => {
            urlset.urlset.url.push({
                loc: [post.url],
                lastmod: [post.date ?? new Date().toISOString().split("T")[0]],
                changefreq: ["monthly"],
                priority: [0.8],
            });
        });

        features.forEach((feature) => {
            const featureUrl = `${process.env.NEXT_PUBLIC_WEB_URL}/${locale}/home/?tutorial=${feature}`;
            urlset.urlset.url.push({
                loc: [featureUrl],
                lastmod: ["2024-11-17"],
                changefreq: ["monthly"],
                priority: [0.8],
            });
        });
    });

    // Конвертируем объект обратно в XML и записываем в файл
    const builder = new xml2js.Builder();
    const xml = builder.buildObject(urlset);
    fs.writeFileSync(sitemapPath, xml, "utf8");
}

// Генерируем локали и создаем новую карту сайта
const locales = getLocalesFromDirectories(baseDir);
createNewSitemap(locales);
