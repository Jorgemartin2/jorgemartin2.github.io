const { default: axios } = require('axios');

const app = require('express')();

app.post('/', async(req,res) => {
    const { url } = req.body

    if(!url) {
        return res.status(400).json({ message: 'url is required' });
    }

    try {
        const response = await axios(url);
        return res.json({ response: response.data });

    } catch(e) {
        return res.json({ message: 'Invalid url' });
    }
})

module.exports = app;