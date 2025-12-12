const express = require('express');
const app = express();

const PORT = process.env.PORT || 8000;

app.use(express.json())

app.use('/proxy', require('./controllers/proxy'));
app.use('/internal', require('./controllers/internal'));

app.listen(PORT, () => {
    console.log(`Listening on http://localhost:${PORT}/`);
})