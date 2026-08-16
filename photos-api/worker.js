/**
 * OpenRadar JetPhotos API
 *
 * Local Wrangler/workerd API for JetPhotos.
 *
 * IMPORTANT:
 * JetPhotos can sometimes return unrelated results for an exact
 * registration search. We therefore:
 *
 * 1. Search JetPhotos.
 * 2. Filter results ourselves by exact registration.
 * 3. If nothing matches, try the JetPhotos registration page.
 *
 * Endpoint:
 *   GET /
 *
 * Example:
 *   /?page=1&keywords=G-EZDH&keywords-type=registration&keywords-contain=0
 *
 * Health:
 *   /health
 */

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

const JETPHOTOS = "https://www.jetphotos.com";

function json(data, status = 200) {
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                ...CORS_HEADERS,
            },
        }
    );
}

function normalizeRegistration(value) {
    return String(value || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

function absoluteUrl(value) {
    if (!value) {
        return null;
    }

    if (value.startsWith("//")) {
        return "https:" + value;
    }

    if (value.startsWith("http://") || value.startsWith("https://")) {
        return value;
    }

    if (value.startsWith("/")) {
        return JETPHOTOS + value;
    }

    return value;
}

function makeFullImageUrl(url) {
    if (!url) {
        return null;
    }

    url = absoluteUrl(url);

    if (!url) {
        return null;
    }

    /*
     * JetPhotos thumbnails commonly look like:
     *
     * /400/6/1234567_xxxxx.jpg
     *
     * Full images:
     *
     * /full/6/1234567_xxxxx.jpg
     */

    return url
        .replace("/400/", "/full/")
        .replace("/240/", "/full/")
        .replace("/800/", "/full/");
}

/**
 * Parse JetPhotos HTML.
 */
async function parseJetPhotos(html) {
    const photos = [];

    class PhotoHandler {
        constructor() {
            this.currentPhoto = null;

            this.insideInfo = false;
            this.infoText = "";
            this.linkHref = "";
            this.linkText = "";

            this.statText = "";
        }

        photoContainer(element) {
            if (!element.hasAttribute("data-photo")) {
                return;
            }

            const photoId = element.getAttribute("data-photo");

            this.currentPhoto = {
                photoId: photoId || null,

                thumbnailUrl: null,
                imageUrl: null,
                photoPageUrl: null,

                registration: null,
                registrationUrl: null,

                aircraftType: null,

                airline: null,
                airlineUrl: null,

                photographer: null,
                photographerUrl: null,

                location: null,
                locationUrl: null,

                photoDate: null,
                uploadedDate: null,

                likes: "0",
                comments: "0",
                views: "0",
            };

            element.onEndTag(() => {
                if (this.currentPhoto) {
                    photos.push(this.currentPhoto);
                    this.currentPhoto = null;
                }
            });
        }

        photoImage(element) {
            if (!this.currentPhoto) {
                return;
            }

            const src =
                element.getAttribute("src") ||
                element.getAttribute("data-src") ||
                element.getAttribute("data-original");

            if (src) {
                this.currentPhoto.thumbnailUrl = absoluteUrl(src);
                this.currentPhoto.imageUrl =
                    makeFullImageUrl(src);
            }

            const alt = element.getAttribute("alt");

            if (alt) {
                /*
                 * Some JetPhotos pages contain useful information
                 * in the image alt text.
                 */

                const parts = alt
                    .split("-")
                    .map(x => x.trim())
                    .filter(Boolean);

                if (parts.length >= 1) {
                    const reg = normalizeRegistration(parts[0]);

                    if (reg) {
                        this.currentPhoto.registration = reg;
                    }
                }

                if (parts.length >= 2) {
                    this.currentPhoto.aircraftType =
                        parts[1].trim();
                }

                if (parts.length >= 3) {
                    this.currentPhoto.airline =
                        parts[2].trim();
                }
            }
        }

        photoLink(element) {
            if (!this.currentPhoto) {
                return;
            }

            const href = element.getAttribute("href");

            if (href) {
                this.currentPhoto.photoPageUrl =
                    absoluteUrl(href);
            }
        }

        infoItem(element) {
            if (!this.currentPhoto) {
                return;
            }

            this.insideInfo = true;
            this.infoText = "";
            this.linkHref = "";
            this.linkText = "";

            element.onEndTag(() => {
                if (!this.currentPhoto) {
                    return;
                }

                const fullText =
                    this.infoText
                        .replace(/\s+/g, " ")
                        .trim();

                const linkText =
                    this.linkText
                        .replace(/\s+/g, " ")
                        .trim();

                let value =
                    linkText || fullText;

                if (fullText.includes("Reg:")) {
                    value = fullText
                        .replace("Reg:", "")
                        .trim()
                        .split(/\s+/)[0];

                    this.currentPhoto.registration =
                        normalizeRegistration(value);

                    if (this.linkHref) {
                        this.currentPhoto.registrationUrl =
                            absoluteUrl(this.linkHref);
                    }
                }

                else if (fullText.includes("Aircraft:")) {
                    this.currentPhoto.aircraftType =
                        fullText
                            .replace("Aircraft:", "")
                            .trim();
                }

                else if (fullText.includes("Airline:")) {
                    this.currentPhoto.airline =
                        value;

                    if (this.linkHref) {
                        this.currentPhoto.airlineUrl =
                            absoluteUrl(this.linkHref);
                    }
                }

                else if (fullText.includes("Location:")) {
                    this.currentPhoto.location =
                        value;

                    if (this.linkHref) {
                        this.currentPhoto.locationUrl =
                            absoluteUrl(this.linkHref);
                    }
                }

                else if (fullText.includes("Photo date:")) {
                    this.currentPhoto.photoDate =
                        fullText
                            .replace("Photo date:", "")
                            .trim();
                }

                else if (fullText.includes("Uploaded:")) {
                    this.currentPhoto.uploadedDate =
                        fullText
                            .replace("Uploaded:", "")
                            .trim();
                }

                else if (
                    fullText.includes("By:") ||
                    fullText.includes("Photographer:")
                ) {
                    this.currentPhoto.photographer =
                        fullText
                            .replace("Photographer:", "")
                            .replace("By:", "")
                            .trim();

                    if (this.linkHref) {
                        this.currentPhoto.photographerUrl =
                            absoluteUrl(this.linkHref);
                    }
                }

                this.insideInfo = false;
            });
        }

        infoTextHandler(text) {
            if (this.insideInfo) {
                this.infoText += text.text;
            }
        }

        infoLink(element) {
            if (
                !this.currentPhoto ||
                !this.insideInfo
            ) {
                return;
            }

            this.linkHref =
                element.getAttribute("href") || "";

            this.linkText = "";
        }

        infoLinkText(text) {
            if (
                this.currentPhoto &&
                this.insideInfo &&
                this.linkHref
            ) {
                this.linkText += text.text;
            }
        }

        stat(element) {
            if (!this.currentPhoto) {
                return;
            }

            this.statText = "";

            element.onEndTag(() => {
                const text =
                    this.statText
                        .replace(/\s+/g, " ")
                        .trim();

                const match = text.match(/\d+/);

                const value =
                    match ? match[0] : "0";

                if (text.includes("Likes:")) {
                    this.currentPhoto.likes = value;
                }

                else if (text.includes("Comments:")) {
                    this.currentPhoto.comments = value;
                }

                else if (text.includes("Views:")) {
                    this.currentPhoto.views = value;
                }
            });
        }

        statTextHandler(text) {
            if (this.currentPhoto) {
                this.statText += text.text;
            }
        }
    }

    const handler = new PhotoHandler();

    await new HTMLRewriter()

        .on(
            "div[data-photo]",
            {
                element:
                    handler.photoContainer.bind(handler),
            }
        )

        .on(
            "img.result__photo",
            {
                element:
                    handler.photoImage.bind(handler),
            }
        )

        .on(
            "a.result__photoLink",
            {
                element:
                    handler.photoLink.bind(handler),
            }
        )

        .on(
            ".result__infoListText",
            {
                element:
                    handler.infoItem.bind(handler),

                text:
                    handler.infoTextHandler.bind(handler),
            }
        )

        .on(
            ".result__infoListText a",
            {
                element:
                    handler.infoLink.bind(handler),

                text:
                    handler.infoLinkText.bind(handler),
            }
        )

        .on(
            ".result__stat",
            {
                element:
                    handler.stat.bind(handler),

                text:
                    handler.statTextHandler.bind(handler),
            }
        )

        .transform(
            new Response(html)
        )
        .text();

    return photos;
}

/**
 * Fetch JetPhotos HTML.
 */
async function fetchJetPhotos(url) {
    const headers = {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/151.0.0.0 Safari/537.36",

        "Accept":
            "text/html,application/xhtml+xml," +
            "application/xml;q=0.9,image/avif," +
            "image/webp,*/*;q=0.8",

        "Accept-Language":
            "en-GB,en;q=0.9",

        "Referer":
            "https://www.jetphotos.com/",
    };

    const response = await fetch(
        url,
        {
            method: "GET",
            headers,
            redirect: "follow",
        }
    );

    if (!response.ok) {
        throw new Error(
            `JetPhotos returned ${response.status} ${response.statusText}`
        );
    }

    return await response.text();
}

/**
 * Search JetPhotos.
 */
async function searchJetPhotos(params) {
    const page =
        params.get("page") || "1";

    const sortOrder =
        params.get("sort-order") || "0";

    const keywords =
        params.get("keywords") || "";

    const keywordsType =
        params.get("keywords-type") || "all";

    const keywordsContain =
        params.get("keywords-contain") || "3";

    const jetParams =
        new URLSearchParams();

    jetParams.set(
        "page",
        page
    );

    jetParams.set(
        "sort-order",
        sortOrder
    );

    jetParams.set(
        "keywords-contain",
        keywordsContain
    );

    jetParams.set(
        "keywords-type",
        keywordsType
    );

    jetParams.set(
        "keywords",
        keywords
    );

    jetParams.set(
        "aircraft",
        params.get("aircraft") || "all"
    );

    jetParams.set(
        "airline",
        params.get("airline") || "all"
    );

    jetParams.set(
        "country-location",
        params.get("country") || "all"
    );

    jetParams.set(
        "photo-year",
        params.get("year") || "all"
    );

    jetParams.set(
        "photographer-group",
        params.get("photographer") || "all"
    );

    jetParams.set(
        "category",
        params.get("category") || "all"
    );

    jetParams.set(
        "width",
        params.get("width") || ""
    );

    jetParams.set(
        "height",
        params.get("height") || ""
    );

    jetParams.set(
        "genre",
        "all"
    );

    jetParams.set(
        "search-type",
        "Advanced"
    );

    const targetUrl =
        `${JETPHOTOS}/showphotos.php?${jetParams.toString()}`;

    const html =
        await fetchJetPhotos(targetUrl);

    const photos =
        await parseJetPhotos(html);

    return {
        photos,
        targetUrl,
    };
}

/**
 * Dedicated registration lookup.
 *
 * This is the important part.
 *
 * If JetPhotos' search page ignores the registration
 * filter, we try the registration page directly.
 */
async function findRegistration(registration) {
    const wanted =
        normalizeRegistration(registration);

    if (!wanted) {
        return null;
    }

    console.log(
        `Looking for registration: ${wanted}`
    );

    /*
     * First attempt:
     * exact registration search.
     */
    const searchParams =
        new URLSearchParams();

    searchParams.set(
        "page",
        "1"
    );

    searchParams.set(
        "sort-order",
        "0"
    );

    searchParams.set(
        "keywords",
        wanted
    );

    searchParams.set(
        "keywords-type",
        "registration"
    );

    searchParams.set(
        "keywords-contain",
        "0"
    );

    searchParams.set(
        "aircraft",
        "all"
    );

    searchParams.set(
        "airline",
        "all"
    );

    searchParams.set(
        "country-location",
        "all"
    );

    searchParams.set(
        "photo-year",
        "all"
    );

    searchParams.set(
        "photographer-group",
        "all"
    );

    searchParams.set(
        "category",
        "all"
    );

    searchParams.set(
        "width",
        ""
    );

    searchParams.set(
        "height",
        ""
    );

    searchParams.set(
        "genre",
        "all"
    );

    searchParams.set(
        "search-type",
        "Advanced"
    );

    const searchUrl =
        `${JETPHOTOS}/showphotos.php?${searchParams.toString()}`;

    try {
        const html =
            await fetchJetPhotos(searchUrl);

        const photos =
            await parseJetPhotos(html);

        /*
         * NEVER trust JetPhotos' search filtering.
         * Check every returned registration ourselves.
         */
        const exact =
            photos.filter(photo => {
                return (
                    normalizeRegistration(
                        photo.registration
                    ) === wanted
                );
            });

        if (exact.length > 0) {
            console.log(
                `Found ${exact.length} exact photo(s) for ${wanted}`
            );

            return exact;
        }

        console.log(
            `Search returned no exact match for ${wanted}`
        );
    }

    catch (error) {
        console.log(
            "Registration search failed:",
            error.message
        );
    }

    /*
     * SECOND ATTEMPT:
     *
     * JetPhotos has registration pages.
     *
     * Example:
     * https://www.jetphotos.com/registration/G-EZDH
     */
    const registrationUrl =
        `${JETPHOTOS}/registration/${encodeURIComponent(wanted)}`;

    try {
        console.log(
            `Trying registration page: ${registrationUrl}`
        );

        const html =
            await fetchJetPhotos(registrationUrl);

        const photos =
            await parseJetPhotos(html);

        const exact =
            photos.filter(photo => {
                const photoReg =
                    normalizeRegistration(
                        photo.registration
                    );

                return (
                    photoReg === wanted ||
                    photoReg === ""
                );
            });

        /*
         * If the registration page didn't expose the
         * registration in the parsed fields, we still
         * attach the requested registration to photos
         * from that dedicated page.
         */
        if (exact.length > 0) {
            for (const photo of exact) {
                if (!photo.registration) {
                    photo.registration = wanted;
                }

                if (!photo.registrationUrl) {
                    photo.registrationUrl =
                        registrationUrl;
                }
            }

            console.log(
                `Found ${exact.length} photo(s) on registration page`
            );

            return exact;
        }
    }

    catch (error) {
        console.log(
            "Registration page failed:",
            error.message
        );
    }

    return null;
}

/**
 * Main request handler.
 */
async function handleRequest(request) {
    if (request.method === "OPTIONS") {
        return new Response(
            null,
            {
                status: 204,
                headers: CORS_HEADERS,
            }
        );
    }

    const url =
        new URL(request.url);

    /*
     * Health endpoint.
     */
    if (url.pathname === "/health") {
        return json({
            ok: true,
            free: true,
            mode: "workerd-direct",
            provider: "local-workerd",
        });
    }

    /*
     * Dedicated registration endpoint.
     *
     * /registration/G-EZDH
     */
    if (
        url.pathname.startsWith(
            "/registration/"
        )
    ) {
        const registration =
            decodeURIComponent(
                url.pathname.substring(
                    "/registration/".length
                )
            );

        try {
            const photos =
                await findRegistration(
                    registration
                );

            return json({
                photos: photos || [],
                count: photos
                    ? photos.length
                    : 0,

                registration:
                    normalizeRegistration(
                        registration
                    ),

                found:
                    Boolean(
                        photos &&
                        photos.length
                    ),

                meta: {
                    free: true,
                    mode: "workerd-direct",
                    provider: "local-workerd",
                    cached: false,
                },
            });
        }

        catch (error) {
            console.error(
                "Registration lookup error:",
                error
            );

            return json(
                {
                    error:
                        "Registration lookup failed",

                    details:
                        error.message,
                },
                500
            );
        }
    }

    /*
     * Normal search endpoint.
     */
    try {
        const params =
            url.searchParams;

        const photos =
            await searchJetPhotos(
                params
            );

        return json({
            photos:
                photos.photos,

            count:
                photos.photos.length,

            meta: {
                free: true,
                mode: "workerd-direct",
                provider: "local-workerd",
                cached: false,

                targetUrl:
                    photos.targetUrl,
            },
        });
    }

    catch (error) {
        console.error(
            "Worker processing error:",
            error
        );

        return json(
            {
                error:
                    "Internal API Proxy Error",

                details:
                    error.message,
            },
            500
        );
    }
}

/*
 * Wrangler/workerd entry point.
 */
addEventListener(
    "fetch",
    event => {
        event.respondWith(
            handleRequest(
                event.request
            )
        );
    }
);