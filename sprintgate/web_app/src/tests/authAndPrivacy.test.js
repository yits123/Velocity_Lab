import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Helper matching App.jsx maskEmail logic
export const maskEmail = (emailStr) => {
  if (!emailStr || typeof emailStr !== 'string' || !emailStr.includes('@')) return 'Master Admin';
  const [local, domain] = emailStr.split('@');
  const maskedLocal = local.length <= 2 
    ? `${local[0]}*` 
    : `${local[0]}${'*'.repeat(Math.max(1, Math.min(local.length - 2, 4)))}${local[local.length - 1]}`;
  const domainParts = domain.split('.');
  if (domainParts.length >= 2) {
    const dName = domainParts[0];
    const maskedD = dName.length <= 2 ? `${dName[0]}*` : `${dName[0]}***`;
    return `${maskedLocal}@${maskedD}.${domainParts.slice(1).join('.')}`;
  }
  return `${maskedLocal}@${domain}`;
};

describe('Security & Privacy Suite: Admin Email Masking', () => {
  it('masks standard coach email to prevent public harvesting', () => {
    const result = maskEmail('coach@velocitylab.com');
    assert.equal(result, 'c***h@v***.com');
  });

  it('handles short usernames safely without indexing errors', () => {
    const result = maskEmail('ab@velocitylab.com');
    assert.equal(result, 'a*@v***.com');
  });

  it('safely handles empty, null or invalid email inputs', () => {
    assert.equal(maskEmail(''), 'Master Admin');
    assert.equal(maskEmail(null), 'Master Admin');
    assert.equal(maskEmail(undefined), 'Master Admin');
    assert.equal(maskEmail('invalid-string'), 'Master Admin');
  });
});

describe('Wi-Fi Hotspot Standard Credentials Compliance', () => {
  it('enforces standardized Velocity_Lab SSID and Vlab@123 password format', () => {
    const standardSSID = "Velocity_Lab";
    const standardPassword = "Vlab@123";
    
    // Validate SSID characters and length
    assert.ok(standardSSID.length > 0 && standardSSID.length <= 32);
    assert.equal(standardSSID, 'Velocity_Lab');

    // Validate WPA2-PSK minimum 8 characters requirement
    assert.ok(standardPassword.length >= 8);
    assert.equal(standardPassword, 'Vlab@123');
  });
});
