/** @jest-environment jsdom */

const prep = require('./trail-photo-prep');

describe('bounded trail photo preparation', () => {
  test('rejects non-images and input files over ten megabytes', () => {
    expect(prep.validate({ type:'text/plain', size:100 }).ok).toBe(false);
    expect(prep.validate({ type:'image/jpeg', size:prep.MAX_INPUT_BYTES + 1 }).ok).toBe(false);
    expect(prep.validate({ type:'image/heic', size:1000 })).toEqual({ ok:true });
  });

  test('resizes the longest edge and returns a bounded jpeg', async () => {
    const drawImage = jest.fn();
    const canvas = {
      width:0,
      height:0,
      getContext:() => ({ drawImage }),
      toDataURL:jest.fn().mockReturnValue('data:image/jpeg;base64,YQ=='),
    };
    class ImageMock {
      constructor(){ this.naturalWidth = 4000; this.naturalHeight = 3000; }
      set src(value){ this._src = value; queueMicrotask(() => this.onload()); }
    }
    const Url = { createObjectURL:jest.fn(() => 'blob:test'), revokeObjectURL:jest.fn() };
    const result = await prep.prepare({ type:'image/jpeg', size:1000 }, {
      document:{ createElement:() => canvas }, URL:Url, Image:ImageMock,
    });
    expect(result).toBe('data:image/jpeg;base64,YQ==');
    expect([canvas.width, canvas.height]).toEqual([900, 675]);
    expect(drawImage).toHaveBeenCalled();
    expect(Url.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  test('photo and hazard pages prepare images before their controllers submit', () => {
    const fs = require('fs');
    const path = require('path');
    ['photo-upload.html', 'trail-report.html'].forEach(file => {
      const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
      expect(html.indexOf('trail-photo-prep.js')).toBeGreaterThan(-1);
      expect(html.indexOf('trail-photo-prep.js')).toBeLessThan(html.indexOf(file === 'photo-upload.html'
        ? 'photo-upload-page.js' : 'trail-report-page.js'));
    });
    expect(fs.readFileSync(path.join(__dirname, 'photo-upload-page.js'), 'utf8'))
      .toContain('DoloPawsTrailPhotoPrep.prepare(file)');
    expect(fs.readFileSync(path.join(__dirname, 'trail-report-page.js'), 'utf8'))
      .toContain('DoloPawsTrailPhotoPrep.prepare(file)');
  });
});
