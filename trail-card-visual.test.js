const visual = require('./trail-card-visual.js');

describe('ORMA trail card visual', () => {
  test('uses a real photo when one exists', () => {
    const html = visual.render({ name:'A trail', imageIcon:'images/trail.webp' });
    expect(html).toContain('trail-visual--photo');
    expect(html).toContain('images/trail.webp');
  });

  test('uses the local responsive asset when a published override points at an original', () => {
    const html = visual.render({
      id:'lago-braies',
      name:'Lago di Braies',
      imageIcon:'https://commons.wikimedia.org/wiki/Special:Redirect/file/Lago_di_Braies_South_Tyrol_5.jpg',
    });
    expect(html).toContain('images/lago-di-braies-480.webp 480w');
    expect(html).toContain('images/lago-di-braies.webp 900w');
    expect(html).not.toContain('Lago_di_Braies_South_Tyrol_5.jpg');
  });

  test('requests thumbnails rather than full Commons originals', () => {
    const source = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Other_trail.jpg';
    const html = visual.render({ id:'other', name:'Other trail', imageIcon:source });
    expect(html).toContain('Other_trail.jpg?width=480');
    expect(html).toContain('Other_trail.jpg?width=320 320w');
    expect(html).toContain('Other_trail.jpg?width=640 640w');
  });

  test('renders a consistent route preview without a photo', () => {
    const html = visual.render({ name:'A loop', path:[[46,11],[46.1,11.2],[46,11]] });
    expect(html).toContain('trail-visual--route');
    expect(html).toContain('polyline');
    expect(html).toContain('route preview');
  });

  test('renders a deliberate placeholder when no visual data exists', () => {
    const html = visual.render({ name:'Unmapped trail' });
    expect(html).toContain('trail-visual--placeholder');
    expect(html).toContain('Photo coming soon');
    expect(html).not.toContain('repeating-linear-gradient');
  });

  test('accepts localized route and placeholder labels', () => {
    const route = visual.render({ name:'Anello' , path:[[46,11],[46.1,11.2]] }, {
      routeLabel:'{name}: anteprima del percorso',
    });
    const placeholder = visual.render({ name:'Sentiero' }, {
      placeholderAria:'{name}: foto in arrivo',
      placeholderLabel:'Foto in arrivo',
    });

    expect(route).toContain('Anello: anteprima del percorso');
    expect(placeholder).toContain('Sentiero: foto in arrivo');
    expect(placeholder).toContain('Foto in arrivo');
  });
});
