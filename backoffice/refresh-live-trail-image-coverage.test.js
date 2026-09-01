const {sourcingCapacity}=require('./cli/refresh-live-trail-image-coverage');

describe('live trail image coverage capacity',()=>{
  test('uses the configured manual batch size',()=>{
    expect(sourcingCapacity({ORMA_IMAGE_SOURCING_CAPACITY:'5'})).toBe(5);
  });

  test('keeps production capacity within the operating limit',()=>{
    expect(sourcingCapacity({ORMA_IMAGE_SOURCING_CAPACITY:'99'})).toBe(15);
    expect(sourcingCapacity({ORMA_IMAGE_SOURCING_CAPACITY:'0'})).toBe(1);
    expect(sourcingCapacity({})).toBe(15);
  });
});
