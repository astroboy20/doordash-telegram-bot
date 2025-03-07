require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");
const cheerio = require("cheerio");

const bot = new Telegraf(process.env.BOT_TOKEN);
