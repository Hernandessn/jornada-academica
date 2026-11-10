const express = require('express');
const db = require('../db');
const { assincrono } = require('../utils/async');

const router = express.Router();

// GET /api/eventos  (público) -> { eventos: [{ id, titulo, data, carga_horaria }] }
router.get(
  '/',
  assincrono(async (req, res) => {
    const linhas = await db('eventos')
      .select('id', 'titulo', 'data', 'carga_horaria')
      .orderBy('data')
      .orderBy('id');

    res.json({
      eventos: linhas.map((e) => ({ ...e, carga_horaria: Number(e.carga_horaria) })),
    });
  })
);

module.exports = router;
