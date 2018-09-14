const express = require('express');
const router = express.Router();
const fs = require('fs');
const request = require('request');
const cheerio = require('cheerio');
const urls = require('../urls');
const scrapeIt = require('scrape-it');
const puppeteer = require('puppeteer');
const download = require('image-downloader');

router.get('/scraper-1', function(req, res, next) {
    scrapeIt(
        urls[0],
        {
            posts: {
                listItem: 'article.photo',
                data: {
                    img: {
                        selector: '.photo-wrapper img',
                        attr: 'src'
                    },
                    caption: 'figcaption.caption'
                    // tags: '.inline-meta.has-tags'
                }
            }
        },
        (err, { data }) => {
            res.json(data);
        }
    );
});

router.get('/scraper-2', function(req, res, next) {
    async function scrapeInfiniteScrollItems(
        page,
        extractItems,
        itemTargetCount,
        scrollDelay = 1000
    ) {
        let items = [];
        try {
            let previousHeight;
            while (items.length < itemTargetCount) {
                items = await page.evaluate(extractItems);
                previousHeight = await page.evaluate(
                    'document.body.scrollHeight'
                );
                await page.evaluate(
                    'window.scrollTo(0, document.body.scrollHeight)'
                );
                await page.waitForFunction(
                    `document.body.scrollHeight > ${previousHeight}`
                );
                await page.waitFor(scrollDelay);
            }
        } catch (e) {}
        return items;
    }

    (async () => {
        // Set up browser and page.
        const browser = await puppeteer.launch({
            headless: true,
            timeout: 0,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        page.setViewport({ width: 1280, height: 926 });

        // Navigate to the demo page.
        await page.goto(urls[1], {
            timeout: 0
        });

        // Scroll and extract items from the page.
        const items = await scrapeInfiniteScrollItems(page, extractItems, 50);

        // Save extracted items to a file.
        fs.writeFileSync('./items.txt', items.join('\n') + '\n');

        // Close the browser.
        await browser.close();

        await res.json({
            success: true
        });
    })();
});

function extractItems() {
    const extractedElements = document.querySelectorAll(
        '#posts article.photo div.photo-wrapper img'
        // '.the-posts article.type_photo img'
    );
    const items = [];
    for (let element of extractedElements) {
        items.push(element.getAttribute('src'));
    }
    return items;
}

router.get('/download', function(req, res, next) {
    let file = fs.readFileSync('./items.txt', 'utf8');
    file = file.split('\n').filter(line => line.length > 0);

    file.forEach(line => {
        const options = {
            url: line,
            dest: 'public/downloads'
        };

        downloadIMG(options);
    });

    res.json({
        downloaded: true
    });
});
async function downloadIMG(options) {
    try {
        const { filename, image } = await download.image(options);
        console.log(filename); // => /path/to/dest/image.jpg
        return filename;
    } catch (e) {
        console.error(e);
    }
}
module.exports = router;
