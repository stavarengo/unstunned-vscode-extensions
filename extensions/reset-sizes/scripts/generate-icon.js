#!/usr/bin/env node

/**
 * Simple icon generator for the Reset Sizes extension
 * Creates a 128x128 PNG icon
 */

const fs = require('fs');
const path = require('path');

let canvas;
try {
  canvas = require('canvas');
} catch (err) {
  // canvas module not available, will use fallback
}

const iconPath = path.join(__dirname, '..', 'images', 'icon.png');

if (canvas) {
  try {
    // Create a 128x128 canvas
    const canvasInstance = canvas.createCanvas(128, 128);
    const ctx = canvasInstance.getContext('2d');

    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 128, 128);
    gradient.addColorStop(0, '#2E7D32');    // Dark green
    gradient.addColorStop(1, '#66BB6A');    // Light green

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    // Draw "RS" text in the center
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RS', 64, 64);

    // Save as PNG
    const buffer = canvasInstance.toBuffer('image/png');
    fs.writeFileSync(iconPath, buffer);

    console.log(`Icon created at: ${iconPath}`);
    process.exit(0);
  } catch (err) {
    console.error('Error creating icon with canvas:', err);
  }
}

// Fallback: Create a simple but visually appealing PNG using SVG data URL
console.log('Creating fallback icon...');

// Create an SVG that represents "reset sizes" concept
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2E7D32;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#66BB6A;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" fill="url(#grad)" rx="16"/>
  <text x="64" y="72" font-family="Arial, sans-serif" font-size="48" font-weight="bold"
        fill="white" text-anchor="middle">RS</text>
</svg>`;

// For now, since we don't have image conversion tools, create a simple colored PNG
// This is a valid 128x128 green PNG that can serve as a placeholder
const simplePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAABGdBTUEAALGPC/xhBQAAACBjSFJN' +
  'AAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAABmJLR0QA/wD/AP+gvaeTAAAA' +
  'B3RJTUUH5AECERIMOQEAAAL5SURBVHja7doxAQAACMOw/5+2CErsJGDwAAAAAAAAAAAAAAAAAAD4' +
  'yc51AQDuMwCABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBY' +
  'AIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACA' +
  'BQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUA' +
  'WACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgA' +
  'gAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAF' +
  'AFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBY' +
  'AIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACA' +
  'BQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUA' +
  'WACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgA' +
  'gAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAF' +
  'AFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBY' +
  'AIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACA' +
  'BQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWACABQBYAIAFAFgAgAUAWAAAAAAAAAAAAAAAAAAA' +
  'AP/nA0j0AAFSti8rAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDIwLTAxLTAyVDE3OjE4OjEyKzAwOjAw' +
  '5qU8OAAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyMC0wMS0wMlQxNzoxODoxMiswMDowMJf4hIQAAAAA' +
  'SUVORK5CYII=',
  'base64'
);

fs.writeFileSync(iconPath, simplePng);
console.log(`Fallback icon created at: ${iconPath}`);
