const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// ── رموز ثابتة لتغيير الرقم السري (Master Codes) ──
const MASTER_CODE_MEN   = process.env.MASTER_CODE_MEN   || 'GEM-MEN-2025';
const MASTER_CODE_WOMEN = process.env.MASTER_CODE_WOMEN || 'GEM-WOMEN-2025';

// أرقام سرية افتراضية (مشفرة)
let PINS = {
  رجال:   process.env.PIN_MEN   || bcrypt.hashSync('1234', 10),
  سيدات: process.env.PIN_WOMEN || bcrypt.hashSync('1234', 10),
};

// ── التحقق من الرقم السري ──
app.post('/api/auth/verify', async (req, res) => {
  const { section, pin } = req.body;
  if (!section || !pin) return res.status(400).json({ error: 'بيانات ناقصة' });
  const stored = PINS[section];
  if (!stored) return res.status(400).json({ error: 'قسم غير صحيح' });
  const valid = await bcrypt.compare(String(pin), stored);
  if (valid) return res.json({ success: true });
  return res.status(401).json({ error: 'رقم سري خاطئ' });
});

// ── تغيير الرقم السري ──
app.post('/api/auth/change-pin', async (req, res) => {
  const { section, masterCode, newPin } = req.body;
  if (!section || !masterCode || !newPin) return res.status(400).json({ error: 'بيانات ناقصة' });
  const correctMaster = section === 'رجال' ? MASTER_CODE_MEN : MASTER_CODE_WOMEN;
  if (masterCode !== correctMaster) return res.status(401).json({ error: 'رمز التغيير خاطئ' });
  if (String(newPin).length < 4) return res.status(400).json({ error: 'الرقم السري يجب أن يكون 4 أرقام على الأقل' });
  PINS[section] = await bcrypt.hash(String(newPin), 10);
  res.json({ success: true, message: 'تم تغيير الرقم السري بنجاح' });
});

// ── Members Routes ──
app.get('/api/members', async (req, res) => {
  try {
    const { section } = req.query;
    const where = section ? { section } : {};
    const members = await prisma.member.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(members);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/members', async (req, res) => {
  try {
    const { name, phone, type, sport, startDate, amount, customDays, section } = req.body;
    const member = await prisma.member.create({
      data: {
        name, phone, type, sport,
        startDate: new Date(startDate),
        amount: parseFloat(amount) || 0,
        customDays: customDays ? parseInt(customDays) : null,
        section: section || 'رجال'
      }
    });
    res.json(member);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/members/:id', async (req, res) => {
  try {
    await prisma.member.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/members/:id/renew', async (req, res) => {
  try {
    const { startDate } = req.body;
    const member = await prisma.member.update({
      where: { id: parseInt(req.params.id) },
      data: { startDate: new Date(startDate) }
    });
    res.json(member);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
