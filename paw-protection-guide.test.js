const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(
  path.join(__dirname, 'guides', 'paw-protection.html'),
  'utf8'
);

describe('paw protection field guide', () => {
  beforeEach(() => {
    document.body.innerHTML = html;
  });

  test('leads with a terrain comparison before training and first aid', () => {
    const surface = document.querySelector('.paw-surface');
    const training = document.querySelector('.paw-conditioning');
    const veterinary = document.querySelector('#call-vet');

    expect(surface).not.toBeNull();
    expect(training).not.toBeNull();
    expect(document.querySelector('#call-vet')).not.toBeNull();
    expect(surface.compareDocumentPosition(training)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(training.compareDocumentPosition(veterinary)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  test('uses three project-bound documentary terrain photographs', () => {
    const terrainImages = Array.from(document.querySelectorAll('.paw-terrain-strip img'));

    expect(terrainImages).toHaveLength(3);
    expect(terrainImages.map(image => image.getAttribute('src'))).toEqual([
      '../images/editorial/paw-terrain-limestone-real-v1.jpg',
      '../images/editorial/paw-terrain-scree-real-v1.jpg',
      '../images/editorial/paw-terrain-compact-real-v1.jpg',
    ]);
    terrainImages.forEach(image => expect(image.getAttribute('alt')).toBeTruthy());
  });

  test('keeps the preparation progression concise and ordered', () => {
    const steps = Array.from(document.querySelectorAll('.paw-training-step strong'));

    expect(steps.map(step => step.textContent.trim())).toEqual([
      'Build',
      'Rehearse',
      'Recover',
    ]);
    expect(document.querySelector('.paw-principle').textContent.trim()).toBe(
      'Change one variable at a time: duration, elevation or surface.'
    );
  });

  test('keeps every urgent veterinary threshold visible', () => {
    const emergencyText = document.querySelector('#call-vet').textContent;

    expect(emergencyText).toMatch(/10 to 15 minutes of steady pressure/i);
    expect(emergencyText).toMatch(/deep or gaping wound/i);
    expect(emergencyText).toMatch(/exposed tissue/i);
    expect(emergencyText).toMatch(/deeply embedded object/i);
    expect(emergencyText).toMatch(/cannot stand or walk/i);
  });

  test('preserves the dog field image and provides a mobile-safe editorial structure', () => {
    const heroImage = document.querySelector('.paw-hero-photo__inner');

    expect(heroImage.getAttribute('style')).toContain('paw-check-generated-small-v1.jpg');
    expect(heroImage.getAttribute('aria-label')).toMatch(/inspect its pads/i);
    expect(html).toMatch(/@media\(max-width:720px\)/);
    expect(html).toMatch(/\.paw-terrain-strip\{grid-template-columns:1fr;/);
    expect(html).toMatch(/\.paw-training-line\{grid-template-columns:1fr;/);
  });
});
