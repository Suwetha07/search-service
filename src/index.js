const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3003';

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'search-service' }));

// Full-text product search with filters
app.get('/search', async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, minRating, maxDelivery, availability, sort, page = 1, limit = 20 } = req.query;
    
    // Fetch products from product service
    const response = await axios.get(`${PRODUCT_SERVICE}/products`, { params: { limit: 200 } });
    let products = response.data.products || [];

    // Full-text search
    if (q) {
      const query = q.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.description.toLowerCase().includes(query) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(query))) ||
        (p.category && p.category.toLowerCase().includes(query)) ||
        (p.brand && p.brand.toLowerCase().includes(query))
      );
    }

    // Filters
    if (category) products = products.filter(p => p.category === category);
    if (minPrice) products = products.filter(p => p.price >= Number(minPrice));
    if (maxPrice) products = products.filter(p => p.price <= Number(maxPrice));
    if (minRating) products = products.filter(p => p.rating >= Number(minRating));
    if (maxDelivery) products = products.filter(p => p.deliveryDays <= Number(maxDelivery));
    if (availability === 'true') products = products.filter(p => p.availability);

    // Sort
    if (sort === 'price_asc') products.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') products.sort((a, b) => b.price - a.price);
    else if (sort === 'rating') products.sort((a, b) => b.rating - a.rating);
    else if (sort === 'delivery') products.sort((a, b) => a.deliveryDays - b.deliveryDays);
    else if (sort === 'newest') products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const total = products.length;
    const startIdx = (Number(page) - 1) * Number(limit);
    products = products.slice(startIdx, startIdx + Number(limit));

    res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get filter options
app.get('/filters', async (req, res) => {
  try {
    const response = await axios.get(`${PRODUCT_SERVICE}/products`, { params: { limit: 500 } });
    const products = response.data.products || [];
    const categories = [...new Set(products.map(p => p.category))];
    const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];
    const priceRange = { min: Math.min(...products.map(p => p.price)), max: Math.max(...products.map(p => p.price)) };
    res.json({ categories, brands, priceRange });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log search (for recommendations)
app.post('/search/log', async (req, res) => {
  try {
    const { userId, query, results } = req.body;
    // In production, this would log to a search analytics DB
    console.log(`Search log: user=${userId}, query=${query}, results=${results}`);
    res.json({ logged: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => console.log(`Search Service running on port ${PORT}`));
