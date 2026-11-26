import bananasImg from './assets/bananas.jpg';
import beansImg from './assets/beans.jpg';
import cabbageImg from './assets/cabbage.jpg';
import carrotsImg from './assets/carrots.jpg';
import leafyGreensImg from './assets/leafy-greens.jpg';
import potatoesImg from './assets/potatoes.jpg';
import riceImg from './assets/rice.jpg';
import tomatoesImg from './assets/tomatoes.jpg';
import type { CropCategoryKey } from './types';

export function getProduceImage(cropName: string, category: CropCategoryKey): string {
  const name = cropName.trim().toLowerCase();

  if (name.includes('tomato')) return tomatoesImg;
  if (name.includes('carrot')) return carrotsImg;
  if (name.includes('potato')) return potatoesImg;
  if (name.includes('cabbage')) return cabbageImg;
  if (name.includes('bean')) return beansImg;
  if (name.includes('banana')) return bananasImg;
  if (name.includes('rice') || name.includes('paddy')) return riceImg;
  if (name.includes('leafy') || name.includes('spinach') || name.includes('green') || name.includes('lettuce')) {
    return leafyGreensImg;
  }

  switch (category) {
    case 'fruits':
      return bananasImg;
    case 'leafy_greens':
      return leafyGreensImg;
    case 'root_crops':
      return carrotsImg;
    case 'grains':
      return riceImg;
    case 'vegetables':
      return tomatoesImg;
    default:
      return cabbageImg;
  }
}
