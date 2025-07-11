// src/core/db-handler.js
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

async function readDB() {
    try {
        await fs.mkdir(path.dirname(config.dbPath), { recursive: true });
        const data = await fs.readFile(config.dbPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { reservations: [] };
        }
        throw error;
    }
}

async function writeDB(data) {
    await fs.mkdir(path.dirname(config.dbPath), { recursive: true });
    await fs.writeFile(config.dbPath, JSON.stringify(data, null, 2), 'utf-8');
}

async function saveReservation(reservationData) {
    const db = await readDB();
    const newReservation = { 
        id: `res_${Date.now()}`, 
        timestamp: new Date().toISOString(), 
        ...reservationData 
    };
    db.reservations.push(newReservation);
    await writeDB(db);
    console.log("[DB] ✅ Rezervasyon veritabanına kaydedildi:", newReservation.id);
    return newReservation;
}

module.exports = { readDB, writeDB, saveReservation };