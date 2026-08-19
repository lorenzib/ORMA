'use strict';

const VERSION = '1.0.0';

function isPosition(value){
  return Array.isArray(value) && value.length === 2 &&
    Number.isFinite(value[0]) && value[0] >= -180 && value[0] <= 180 &&
    Number.isFinite(value[1]) && value[1] >= -90 && value[1] <= 90;
}

function validateCandidate(candidate){
  const errors = [];
  if(!candidate || typeof candidate !== 'object') return ['candidate must be an object'];
  if(candidate.contractVersion !== VERSION) errors.push(`contractVersion must be ${VERSION}`);
  if(typeof candidate.id !== 'string' || !candidate.id) errors.push('id is required');
  if(typeof candidate.name !== 'string' || !candidate.name.trim()) errors.push('name is required');
  if(typeof candidate.state !== 'string') errors.push('state is required');
  if(!candidate.source || candidate.source.provider !== 'openstreetmap') errors.push('an OpenStreetMap source is required');
  if(!candidate.source || typeof candidate.source.externalId !== 'string') errors.push('source.externalId is required');
  if(!candidate.geometry || candidate.geometry.type !== 'LineString') errors.push('geometry must be a LineString');
  const coordinates = candidate.geometry && candidate.geometry.coordinates;
  if(!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every(isPosition)){
    errors.push('geometry.coordinates must contain valid positions');
  }
  if(!candidate.geometryAssessment || typeof candidate.geometryAssessment.status !== 'string'){
    errors.push('geometryAssessment is required');
  }
  if(!Array.isArray(candidate.evidenceRequired)) errors.push('evidenceRequired must be an array');
  if(!Array.isArray(candidate.history)) errors.push('history must be an array');
  return errors;
}

module.exports = { VERSION, validateCandidate, isPosition };
