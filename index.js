const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');

const timeWait = new Map()
const keyTime = 'timeAuth'

class Fintopio {
  constructor() {
    this.baseUrl = 'https://fintopio-tg.fintopio.com/api';
    this.headers = {
      Accept: 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language':
        'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
      Referer: 'https://fintopio-tg.fintopio.com/',
      'Sec-Ch-Ua':
        '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
      'Sec-Ch-Ua-Mobile': '?1',
      'Sec-Ch-Ua-Platform': '"Android"',
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36',
    };
  }

  log(msg) {
    console.log(`[*] ${msg}`);
  }

  async waitWithCountdown(seconds) {
    for (let i = seconds; i >= 0; i--) {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(`===== Tunggu ${i} detik untuk melanjutkan =====`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    console.log('');
  }

  async auth(userData) {
    const url = `${this.baseUrl}/auth/telegram`;
    const headers = { ...this.headers, Webapp: 'true' };

    try {
      const response = await axios.get(`${url}?${userData}`, { headers });
      return response.data.token;
    } catch (error) {
      this.log(`Kesalahan saat otentikasi: ${error.message}`.red);
      return null;
    }
  }

  async getProfile(token) {
    const url = `${this.baseUrl}/referrals/data`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      Webapp: 'false, true',
    };

    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      this.log(`Kesalahan saat mengambil informasi profil: ${error.message}`.red);
      return null;
    }
  }

  async checkInDaily(token) {
    const url = `${this.baseUrl}/daily-checkins`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios.post(url, {}, { headers });
      this.log('Check-in harian berhasil!'.green);
    } catch (error) {
      this.log(`Kesalahan saat check-in harian: ${error.message}`.red);
    }
  }

  async checkTask(token, id) {
    if (!id) {
      this.log(`Id [ ${id} ] tidak valid! ${error.message}`.red);
      return;
    }
    const url = `${this.baseUrl}/hold/tasks/${id}/verify`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios.post(url, {}, { headers });
      return response?.status === 'completed' ? 1 : 0;
    } catch (error) {
      this.log(`Kesalahan saat check-in harian: ${error.message}`.red);
    }
  }

  async claimQuest(token, quest) {
    if (!quest?.id) {
      this.log(`Id [ ${quest?.id} ] tidak valid! ${error.message}`.red);
      return;
    }
    const url =
      quest?.status === 'available'
        ? `${this.baseUrl}/hold/tasks/${quest?.id}/start`
        : `${this.baseUrl}/hold/tasks/${quest?.id}/claim`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios.post(url, {}, { headers });
      if (response?.data?.status === 'in-progress') {
        return await this.checkTask(token, quest?.id);
      } else if (response?.data?.status === 'completed') {
        return 1;
      } else {
        this.log(`Quest sedang diverifikasi - status: ${response?.data?.status}`.yellow);
      }
    } catch (error) {}
  }

  async doQuest(token) {
    const url = `${this.baseUrl}/hold/tasks`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      path:'/api/hold/tasks',
      'authority':'fintopio-tg.fintopio.com'
    };

    try {
      const response = await axios.get(url, { headers });
      const listQuest = response?.data?.tasks;
      if (!listQuest.length) return;

      for await (const quest of listQuest) {
        const { id } = quest;
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(
          `${colors.magenta(`[*]`)}` +
            colors.yellow(` Quest : ${colors.white(id)} `) +
            colors.red('Sedang dikerjakan... '),
        );
        const isFinish = await this.claimQuest(token, quest);
        readline.cursorTo(process.stdout, 0);
        if (isFinish) {
          process.stdout.write(
            `${colors.magenta(`[*]`)}` +
              colors.yellow(` Quest : ${colors.white(id)} `) +
              colors.green('Selesai!                  '),
          );
        } else {
          process.stdout.write(
            `${colors.magenta(`[*]`)}` +
              colors.yellow(` Quest : ${colors.white(id)} `) +
              colors.red('Gagal!                  '),
          );
        }
        console.log();
      }
    } catch (error) {
      this.log(`Kesalahan mengambil quest: ${error.message}`.red);
    }
  }

  async getFarmingState(token) {
    const url = `${this.baseUrl}/farming/state`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
    };

    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      this.log(`Kesalahan saat mengambil status farming: ${error.message}`.red);
      return null;
    }
  }

  async startFarming(token) {
    const url = `${this.baseUrl}/farming/farm`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios.post(url, {}, { headers });
      const finishTimestamp = response.data.timings.finish;

      if (finishTimestamp) {
        const finishTime = DateTime.fromMillis(finishTimestamp).toLocaleString(
          DateTime.DATETIME_FULL,
        );
        this.log(`Mulai farming...`.yellow);
        this.log(`Waktu selesai farming: ${finishTime}`.green);
      } else {
        this.log('Tidak ada waktu selesai.'.yellow);
      }
    } catch (error) {
      this.log(`Kesalahan saat mulai farming: ${error.message}`.red);
    }
  }

  async claimFarming(token) {
    const url = `${this.baseUrl}/farming/claim`;
    const headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    try {
      const res = await axios.post(url, {}, { headers });
      this.log('Claim farming berhasil!'.green);
    } catch (error) {
      this.log(`Kesalahan saat claim: ${error.message}`.red);
    }
  }

  extractFirstName(userData) {
    try {
      const userPart = userData.match(/user=([^&]*)/)[1];
      const decodedUserPart = decodeURIComponent(userPart);
      const userObj = JSON.parse(decodedUserPart);
      return userObj.first_name || 'Tidak Diketahui';
    } catch (error) {
      this.log(`Kesalahan saat mengekstrak first_name: ${error.message}`.red);
      return 'Tidak Diketahui';
    }
  }

  calculateWaitTime(firstAccountFinishTime) {
    if (!firstAccountFinishTime) return null;

    const now = Date.now()
    const timeSubtract = firstAccountFinishTime - now
    if(timeSubtract > 0){
      return timeSubtract
    }
  }

  async main() {
    while (true) {
      const dataFile = path.join(__dirname, 'data.txt');
      const data = await fs.readFile(dataFile, 'utf8');
      const users = data.split('\n').filter(Boolean);

      let firstAccountFinishTime = null;
      let time = []

      for (let i = 0; i < users.length; i
