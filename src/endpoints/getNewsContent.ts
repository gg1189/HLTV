const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const router = express.Router(); // or app directly

router.get('/news/:id', async (req, res) => {
  const { id } = req.params; // e.g. 44130
  const url = `https://www.hltv.org/news/${id}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);

    // Extract title (usually in .event text or h1, but HLTV uses specific classes)
    const title = $('h1').first().text().trim() ||
                  $('.event.text-ellipsis').text().trim() ||
                  'Unknown Title';

    // Extract date (usually in byline, format like "19-03-2026" or full)
    let date = $('.news-header__date').text().trim() ||
               $('.byline time').attr('datetime') ||
               $('.author-date').text().match(/\d{2}-\d{2}-\d{4}/)?.[0] ||
               'Unknown Date';

    // Try to normalize date to YYYY-MM-DD
    if (date.includes('-')) {
      const [dd, mm, yyyy] = date.split('-');
      if (dd && mm && yyyy) date = `20${yyyy}-${mm}-${dd}`; // assuming 20xx
    }

    // Extract main body content from .newstext-con
    const bodyBlocks = [];

    const $body = $('.newstext-con');

    // Remove unwanted elements first (read more cards, etc.)
    $body.find('a.news-read-more-1').remove();
    $body.find('.news-read-more').remove();

    // Process each child element
    $body.children().each((i, el) => {
      const $el = $(el);

      // Paragraphs
      if ($el.is('p') && $el.hasClass('news-block') || $el.is('p:not(.headertext)')) {
        const text = $el.text().trim();
        if (text) {
          bodyBlocks.push({
            data: { text },
            type: 'paragraph'
          });
        }
      }

      // Potential headers (HLTV rarely uses h tags in body, but sometimes bold/big text)
      else if ($el.is('h2, h3, .headertext') || ($el.is('p') && $el.hasClass('headertext'))) {
        const text = $el.text().trim();
        if (text) {
          bodyBlocks.push({
            data: { text },
            type: 'header'  // or 'header1'/'header2' depending on your Editor.js config
          });
        }
      }

      // You can add image handling if needed (extract src from picture/img)
      // For now skipping as your example is text-only
    });

    // Fallback if no blocks parsed
    if (bodyBlocks.length === 0) {
      bodyBlocks.push({
        data: { text: 'No content extracted from the page.' },
        type: 'paragraph'
      });
    }

    const result = {
      title,
      date,
      body: {
        blocks: bodyBlocks
      }
    };

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to scrape the news article', details: error.message });
  }
});

// Usage: GET /news/44130
