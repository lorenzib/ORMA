const visual = require('./trail-card-visual.js');

describe('DoloPaws trail card visual', () => {
  test('uses a real photo when one exists', () => {
    const html = visual.render({ name:'A trail', imageIcon:'images/trail.webp' });
    expect(html).toContain('trail-visual--photo');
    expect(html).toContain('images/trail.webp');
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
