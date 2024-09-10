const axios = require("axios");
require("dotenv").config();
const XMLParser = require("fast-xml-parser").XMLParser;
const sharp = require("sharp");

const express = require("express");
const app = express();
const port = 3000;

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});

app.get("/", async (req, res) => {
    const nextcloudClient = await new axios.Axios({
        baseURL: `${
            process.env.NEXTCLOUD_URL
        }/remote.php/dav/photos/${encodeURIComponent(
            process.env.USERNAME
        )}/albums/${encodeURIComponent(process.env.ALBUM)}/`,
        auth: {
            username: process.env.USERNAME,
            password: process.env.PASSWORD,
        },
    });

    const album = await nextcloudClient
        .request({
            data: `<?xml version=\"1.0\"?>
                <d:propfind xmlns:d=\"DAV:\" xmlns:oc=\"http://owncloud.org/ns\" xmlns:nc=\"http://nextcloud.org/ns\" xmlns:ocs=\"http://open-collaboration-services.org/ns\">
                <d:prop>
                    <d:getcontenttype />
                </d:prop>
            </d:propfind>`,
            method: "PROPFIND",
        })
        .then((response) => {
            if (response.status === 404) {
                // Album doesn't exist
                res.status(404).json({
                    error: `Album '${Album}' could not be found`,
                });
                return;
            }
            // Nextcloud returns multiple statuses when it finds an Album.
            if (response.status !== 207) {
                // Album doesn't exist
                res.status(500).json({
                    error: `Unknown response from DAV server`,
                });
                return;
            }
            const data = new XMLParser({
                isArray: (tagName) =>
                    ["d:response", "d:propstat"].includes(tagName),
            }).parse(response.data);
            const innerResponse = data["d:multistatus"]["d:response"];
            // If the album doesn't have any content, this is instead a single response (object)
            if (innerResponse.length === 1) {
                const innerStatus =
                    innerResponse[0]["d:propstat"][0]["d:status"];
                if (innerStatus.endsWith(" 404 Not Found")) {
                    // No images in album.
                    res.status(404).json({
                        error: `Album '${Album}' contains no images.`,
                    });
                } else {
                    res.status(500).json({
                        error: `Unexpected error fetching the album images.`,
                    });
                }
                return;
            }
            // d:response is an array of responses when the album has content.
            const images = innerResponse.filter((item) => {
                const props = Array.isArray(item["d:propstat"])
                    ? item["d:propstat"][0]["d:prop"]
                    : item["d:propstat"]["d:prop"];
                const contentType = props["d:getcontenttype"];
                return !!contentType?.startsWith("image/");
            });
            // we only want the image names
            return images.map((imgData) => imgData["d:href"].split("/").pop());
        })
        .catch((ex) => {
            console.error(`Failed to list images from dav`, ex);
            res.status(500).json({ error: "Failed to make request" });
        });

    // filter out the images that are not jpg (eg. raws)
    // todo: what about heifs?
    const jpgImages = album.filter(
        (img) =>
            img.toLowerCase().endsWith(".jpg") ||
            img.toLowerCase().endsWith(".jpeg")
    );

    if (jpgImages.length === 0) {
        res.status(404).json({ error: "No jpg images found" });
        return;
    }

    // get a random image
    const randomPhoto = jpgImages[Math.floor(Math.random() * jpgImages.length)];

    return nextcloudClient
        .request({
            url: `/${randomPhoto}`,
            method: "GET",
            responseEncoding: "binary",
            responseType: "stream",
        })
        .then(async (response) => {
            const contentType = response.headers["content-type"];
            if (typeof contentType !== "string") {
                throw Error(
                    `Server provided an invalid Content-Type of '${contentType}'`
                );
            }
            if (!contentType.startsWith("image/jpeg")) {
                throw Error(
                    `Server provided an invalid Content-Type of '${contentType}'`
                );
            }
            const chunks = [];
            response.data.on("data", (chunk) => chunks.push(chunk));
            response.data.on("end", async () => {
                const buffer = Buffer.concat(chunks);
                const resizedImg = await sharp(buffer)
                    .rotate()
                    .resize(
                        parseInt(process.env.WIDTH),
                        parseInt(process.env.HEIGHT)
                    )
                    .jpeg()
                    .toBuffer();

                res.status(200);
                res.setHeader("Content-Type", contentType);
                res.send(resizedImg);
            });
        })
        .catch((ex) => {
            console.error(`Failed to get image from dav`, ex);
            res.status(500).json({ error: "Failed to make request" });
        });
});
