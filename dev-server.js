import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;
const ROOT = path.join(__dirname, 'public');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(ROOT));

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRub(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`;
}

function buildLineItemsTable(lines, qtyLabel) {
  if (!lines?.length) return '';
  const rows = lines.map((line) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;color:#333;">${escapeHtml(line.label)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;color:#555;">${formatRub(line.unit ?? line.amount)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;color:#555;">${line.qty ?? qtyLabel ?? '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;font-weight:600;">${line.total != null ? formatRub(line.total) : '—'}</td>
    </tr>`).join('');
  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0 0;">
      <thead>
        <tr style="background:#fafafa;">
          <th style="padding:10px 12px;text-align:left;color:#888;font-weight:600;font-size:12px;">Позиция</th>
          <th style="padding:10px 12px;text-align:right;color:#888;font-weight:600;font-size:12px;">Цена</th>
          <th style="padding:10px 12px;text-align:center;color:#888;font-weight:600;font-size:12px;">Кол-во</th>
          <th style="padding:10px 12px;text-align:right;color:#888;font-weight:600;font-size:12px;">Сумма</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildSubscriptionLinesTable(lines) {
  if (!lines?.length) return '';
  const rows = lines.map((line) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #fde8e6;color:#333;">${escapeHtml(line.label)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #fde8e6;text-align:right;white-space:nowrap;font-weight:600;color:#EF3124;">+ ${formatRub(line.amount)}/мес</td>
    </tr>`).join('');
  return `
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0 0;">
      <thead>
        <tr style="background:#fff5f4;">
          <th style="padding:10px 12px;text-align:left;color:#888;font-weight:600;font-size:12px;">Компонент подписки</th>
          <th style="padding:10px 12px;text-align:right;color:#888;font-weight:600;font-size:12px;">Тариф</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Не задана переменная окружения ${name}. Скопируйте .env.example в .env и заполните SMTP-данные.`);
  }
  return value;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getTransporter() {
  return nodemailer.createTransport({
    host: requireEnv('SMTP_HOST'),
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== 'false',
    auth: {
      user: requireEnv('SMTP_USER'),
      pass: requireEnv('SMTP_PASS'),
    },
  });
}

function buildEmailHtml({ name, company, phone, calculation: c }) {
  const safeName = escapeHtml(name);
  const safeCompany = escapeHtml(company);
  const safePhone = escapeHtml(phone);

  const purchaseLines = c.purchaseLines || [];
  const subscriptionLines = c.subscriptionMonthlyLines || [];
  const registers = c.registers ?? '—';
  const months = c.months ?? (c.years ? c.years * 12 : '—');
  const serviceMonthly = c.serviceMonthly ?? 4000;
  const fullKitFormatted = c.fullKitFormatted || formatRub(c.fullKit);
  const serviceTotalFormatted = c.serviceTotalFormatted || formatRub(c.serviceTotal);
  const unitHardwareFormatted = c.unitHardwareFormatted || formatRub(c.unitHardware);
  const unitPurchaseFormatted = c.unitPurchaseTotalFormatted || formatRub(c.unitPurchaseTotal);

  const purchaseTable = buildLineItemsTable(purchaseLines, registers);
  const subscriptionTable = buildSubscriptionLinesTable(subscriptionLines);

  return `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#222;line-height:1.5;">
  <div style="max-width:680px;margin:0 auto;padding:24px 16px;">
    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
      <div style="background:#EF3124;padding:24px 28px;">
        <div style="color:#fff;font-size:20px;font-weight:700;letter-spacing:.3px;">Альфа-Банк</div>
        <div style="color:rgba(255,255,255,.9);font-size:14px;margin-top:6px;">Кассы самообслуживания</div>
      </div>

      <div style="padding:28px;">
        <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;">Расчёт экономики для вашего бизнеса</h1>
        <p style="margin:0 0 24px;color:#666;font-size:15px;">Здравствуйте, <strong>${safeName}</strong>! Ниже — подробная смета по выбранным параметрам: <strong>${registers} касс</strong> на срок <strong>${escapeHtml(c.yearsLabel || '')}</strong>.</p>

        <div style="background:#fafafa;border:1px solid #eee;border-radius:12px;padding:16px 18px;margin-bottom:28px;">
          <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Контактные данные</div>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:4px 0;color:#888;width:120px;">ФИО</td><td style="padding:4px 0;"><strong>${safeName}</strong></td></tr>
            <tr><td style="padding:4px 0;color:#888;">Компания</td><td style="padding:4px 0;">${safeCompany}</td></tr>
            <tr><td style="padding:4px 0;color:#888;">Телефон</td><td style="padding:4px 0;">${safePhone}</td></tr>
          </table>
        </div>

        <div style="border:1px solid #e8e8e8;border-radius:14px;padding:20px;margin-bottom:20px;">
          <div style="margin-bottom:4px;">
            <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Сценарий 1</div>
            <h2 style="margin:4px 0 0;font-size:18px;color:#222;">🛒 Покупка оборудования</h2>
            <div style="font-size:12px;color:#888;margin-top:8px;">Итого за период</div>
            <div style="font-size:22px;font-weight:700;color:#222;">${escapeHtml(c.purchaseTotalFormatted || '')}</div>
          </div>
          <p style="margin:12px 0 0;font-size:13px;color:#666;">Оборудование на ${registers} касс + обслуживание ${formatRub(serviceMonthly)}/мес на каждую кассу × ${months} мес.</p>
          ${purchaseTable}
          <div style="margin-top:16px;padding-top:16px;border-top:1px dashed #ddd;font-size:14px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0;color:#555;">Оборудование (${unitHardwareFormatted} × ${registers})</td>
                <td style="padding:6px 0;text-align:right;font-weight:600;">${fullKitFormatted}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#555;">Обслуживание (${formatRub(serviceMonthly)} × ${months} мес × ${registers} касс)</td>
                <td style="padding:6px 0;text-align:right;font-weight:600;">${serviceTotalFormatted}</td>
              </tr>
              <tr style="background:#f5f5f5;">
                <td style="padding:10px 12px;font-weight:700;">Вложения за весь период</td>
                <td style="padding:10px 12px;text-align:right;font-weight:700;">${escapeHtml(c.purchaseTotalFormatted || formatRub(c.purchaseTotal))}</td>
              </tr>
              <tr>
                <td style="padding:8px 0 0;color:#888;font-size:13px;">На 1 КСО за период (оборудование + сервис)</td>
                <td style="padding:8px 0 0;text-align:right;color:#888;font-size:13px;">${unitPurchaseFormatted}</td>
              </tr>
            </table>
          </div>
        </div>

        <div style="border:1px solid #f5c4c0;border-radius:14px;padding:20px;margin-bottom:24px;background:#fffafa;">
          <div style="margin-bottom:4px;">
            <div style="font-size:12px;color:#EF3124;text-transform:uppercase;letter-spacing:.5px;">Сценарий 2</div>
            <h2 style="margin:4px 0 0;font-size:18px;color:#EF3124;">📋 Подписка</h2>
            <div style="font-size:12px;color:#888;margin-top:8px;">Итого за период</div>
            <div style="font-size:22px;font-weight:700;color:#EF3124;">${escapeHtml(c.subscriptionTotalFormatted || '')}</div>
          </div>
          <p style="margin:12px 0 0;font-size:13px;color:#666;">Ежемесячный платёж за 1 кассу складывается из выбранной комплектации:</p>
          ${subscriptionTable}
          <div style="margin-top:16px;padding-top:16px;border-top:1px dashed #f0c8c4;font-size:14px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0;color:#555;">Тариф за 1 кассу</td>
                <td style="padding:6px 0;text-align:right;font-weight:600;color:#EF3124;">${escapeHtml(c.monthlyFormatted || formatRub(c.monthly))}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#555;">Платёж в месяц (${registers} касс)</td>
                <td style="padding:6px 0;text-align:right;font-weight:600;">${escapeHtml(c.monthlyPaymentFormatted || formatRub(c.monthlyPayment))}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#555;">Срок</td>
                <td style="padding:6px 0;text-align:right;">${months} мес (${escapeHtml(c.yearsLabel || '')})</td>
              </tr>
              <tr style="background:#fff0ee;">
                <td style="padding:10px 12px;font-weight:700;color:#EF3124;">${escapeHtml(c.monthlyFormatted || formatRub(c.monthly))} × ${registers} × ${months} мес</td>
                <td style="padding:10px 12px;text-align:right;font-weight:700;color:#EF3124;">${escapeHtml(c.subscriptionTotalFormatted || formatRub(c.subscriptionTotal))}</td>
              </tr>
            </table>
          </div>
        </div>

        <div style="background:#f0faf0;border:1px solid #c8e6c9;border-radius:14px;padding:20px;margin-bottom:24px;">
          <div style="font-size:12px;color:#2e7d32;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Сравнение сценариев</div>
          <table style="width:100%;border-collapse:collapse;font-size:15px;">
            <tr>
              <td style="padding:10px 0;color:#555;">Остаётся в обороте в моменте<br><span style="font-size:12px;color:#888;">покупка − первый платёж по подписке</span></td>
              <td style="padding:10px 0;text-align:right;font-weight:700;font-size:18px;color:#2e7d32;">${escapeHtml(c.inCirculationFormatted || formatRub(c.inCirculation))}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#555;">Экономия за период<br><span style="font-size:12px;color:#888;">покупка − подписка</span></td>
              <td style="padding:10px 0;text-align:right;font-weight:700;font-size:18px;color:#EF3124;">${escapeHtml(c.savingsFormatted || formatRub(c.savings))}</td>
            </tr>
          </table>
        </div>

        <p style="font-size:12px;color:#999;margin:0;line-height:1.6;">
          *Расчёт носит информационный характер и не является публичной офертой.
          Индивидуальные условия определяются в рамках переговоров с представителем банка.
        </p>
      </div>

      <div style="background:#fafafa;padding:18px 28px;border-top:1px solid #eee;font-size:13px;color:#888;">
        С уважением, <strong style="color:#333;">Альфа-Банк</strong>
      </div>
    </div>
  </div>
</body>
</html>`;
}

app.post('/api/send-calculation', async (req, res) => {
  try {
    const { name, company, phone, email, calculation } = req.body;

    if (!name?.trim() || !phone?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Заполните имя, телефон и email.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Некорректный адрес email.' });
    }

    if (!calculation) {
      return res.status(400).json({ error: 'Данные расчёта отсутствуют. Пройдите все шаги калькулятора.' });
    }

    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || requireEnv('SMTP_USER');

    await transporter.sendMail({
      from,
      to: email.trim(),
      subject: `Расчёт экономики: кассы самообслуживания — ${calculation.registers} касс`,
      html: buildEmailHtml({
        name: name.trim(),
        company: company?.trim(),
        phone: phone.trim(),
        calculation,
      }),
    });

    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('form_submissions').insert({
        name: name.trim(),
        company: company?.trim() || null,
        phone: phone.trim(),
        email: email.trim(),
        calculation_json: calculation,
      });
      if (error) console.error('[supabase] insert error:', error.message);
    }

    console.log(`[send-calculation] sent to ${email.trim()}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Ошибка отправки:', err.message);
    const message = err.message.includes('SMTP') || err.message.includes('окружения')
      ? err.message
      : 'Не удалось отправить письмо. Проверьте SMTP-настройки в .env';
    res.status(500).json({ error: message });
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  console.log(`\n  Калькулятор:  http://localhost:${PORT}/`);
  console.log(`  API:          http://localhost:${PORT}/api/send-calculation\n`);
});
