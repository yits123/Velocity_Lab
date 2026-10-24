/*
 * Copyright (C) 2026 Velocity Lab
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// You need to set your email credentials in Firebase config:
// firebase functions:config:set gmail.email="your_email@gmail.com" gmail.password="your_app_password"

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL || (functions.config().gmail ? functions.config().gmail.email : ''),
    pass: process.env.GMAIL_PASSWORD || (functions.config().gmail ? functions.config().gmail.password : '')
  }
});

exports.sendSprintEvaluationEmail = functions.firestore
  .document('sprint_evaluations/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    
    // In a real app, you'd look up the user's email based on the bib or name.
    // For now, we will send the report to a default coach email.
    // Set this via: firebase functions:config:set coach.email="coach@example.com"
    const targetEmail = functions.config().coach ? functions.config().coach.email : 'coach@example.com';

    const mailOptions = {
      from: '"SprintGate Automated System" <noreply@sprintgate.com>',
      to: targetEmail,
      subject: `New Sprint Result: ${data.name} - ${data.time}s`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #121316; color: #fff; padding: 20px; border-radius: 10px;">
          <h2 style="color: #00D084;">SprintGate Evaluation</h2>
          <p><strong>Athlete:</strong> ${data.name} (Bib: ${data.bib})</p>
          <p><strong>Time:</strong> <span style="font-size: 24px; color: #00D084;">${data.time}s</span></p>
          <hr style="border-color: #1f2125;" />
          <h3 style="color: #8b8e98;">Analysis:</h3>
          <p><strong>Standing:</strong> ${data.standing}</p>
          <p><strong>F.I.T.T. Profile:</strong> ${data.fitt}</p>
          <p><strong>Sport Match:</strong> ${data.sport}</p>
          <p><strong>Training Focus:</strong> ${data.focus}</p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Email sent successfully for', data.name);
    } catch (error) {
      console.error('Error sending email:', error);
    }
  });
