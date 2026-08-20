const provenance = require('./trail-photo-provenance');

describe('trail photo provenance', () => {
  test('normalizes legacy string credits with a trusted source link', () => {
    expect(provenance.normalizeCredit('Jane Photographer · CC BY-SA 4.0', 'https://example.com/source'))
      .toEqual({
        text:'Jane Photographer · CC BY-SA 4.0',
        url:'https://example.com/source',
        bare:false,
        label:'Photo: Jane Photographer · CC BY-SA 4.0',
      });
  });

  test('supports an owned-photo credit without inventing a source link', () => {
    expect(provenance.heroCredit({ imageCredit:{ text:'Benedetta Lorenzi · ORMA original' } }))
      .toEqual({
        text:'Benedetta Lorenzi · ORMA original',
        url:'',
        bare:false,
        label:'Photo: Benedetta Lorenzi · ORMA original',
      });
  });

  test('only exposes curated repository photos and uses the community caption', () => {
    const photos = provenance.editorialPhotos({
      editorialPhotos:[
        {
          source:'orma-editorial',
          image:'images/tre-cime-gallery-01.jpg',
          alt:'Tre Cime from the circuit trail',
          caption:'Tre Cime di Lavaredo from the circuit trail',
          credit:{ text:'Benedetta Lorenzi · ORMA original' },
        },
        { source:'community', image:'images/not-editorial.jpg' },
        { source:'orma-editorial', image:'https://example.com/untrusted.jpg' },
      ],
    });

    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatchObject({
      image:'images/tre-cime-gallery-01.jpg',
      isEditorial:true,
      editorialOrder:0,
      status:'approved',
    });
    expect(provenance.photoAlt(photos[0])).toBe('Tre Cime from the circuit trail');
    expect(provenance.photoCaption(photos[0])).toBe('Shared by the ORMA community');
  });
});
