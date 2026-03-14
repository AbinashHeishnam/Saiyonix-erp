import express from 'express';

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('SaiyoniX ERP API running');
});

export default app;
