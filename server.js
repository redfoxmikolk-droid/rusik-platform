const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'rusik_db',
  password: '123456',
  port: 5432,
  client_encoding: 'UTF8'
});

// 1. Получить мероприятия
app.get('/api/events', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM events');
        res.json(result.rows);
    } catch (err) {
        res.status(500).send('Ошибка базы данных');
    }
});

// 2. РЕГИСТРАЦИЯ
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
            [name, email, hashedPassword]
        );
        res.json({ success: true, user: newUser.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера при регистрации' });
    }
});

// 3. ВХОД
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Неверный email или пароль' });
        }
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(400).json({ error: 'Неверный email или пароль' });
        }
        res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сервера при входе' });
    }
});

// 4. ПОКУПКА БИЛЕТА (ВОТ ЭТОТ БЛОК МЫ ДОБАВИЛИ)
app.post('/api/buy-ticket', async (req, res) => {
    const { userId, eventId } = req.body;
    try {
        await pool.query(
            'INSERT INTO tickets (user_id, event_id) VALUES ($1, $2)',
            [userId, eventId]
        );
        res.json({ success: true, message: 'Билет успешно куплен!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при покупке билета' });
    }
});

// 5. ПОЛУЧИТЬ БИЛЕТЫ ПОЛЬЗОВАТЕЛЯ
app.get('/api/my-tickets/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // Выполняем запрос с явным указанием кодировки
        await pool.query("SET client_encoding TO 'UTF8';");
        
        const result = await pool.query(`
            SELECT t.id as ticket_id, e.title, e.description, e.price, e.image_url
            FROM tickets t
            JOIN events e ON t.event_id = e.id
            WHERE t.user_id = $1
            ORDER BY t.purchase_date DESC
        `, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при получении билетов' });
    }
});

// 6. ОПЛАТА ТАРИФА ПЛЮС
app.post('/api/buy-plus', async (req, res) => {
    const { userId } = req.body;
    try {
        // Проверяем, хватает ли денег (для теста просто ставим тариф)
        await pool.query('UPDATE users SET is_plus = TRUE WHERE id = $1', [userId]);
        res.json({ success: true, message: 'Тариф Плюс активирован!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка оплаты' });
    }
});

app.listen(3000, '0.0.0.0', () => {
    console.log('Сервер запущен на http://localhost:3000');
});