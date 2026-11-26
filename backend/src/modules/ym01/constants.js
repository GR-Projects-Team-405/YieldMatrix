export const PLATFORM_INFO = {
  name: 'YieldMatrix',
  description: 'A platform connecting farmers, buyers and transport providers around agricultural supply.',
  currency: 'LKR',
  quantityUnit: 'kg',
};

export const PUBLIC_ROLES = [
  {
    role: 'farmer',
    name: 'Farmer',
    description: 'Manages farm and harvest information and offers available produce to buyers.',
    responsibilities: ['Maintain farm and harvest details', 'Publish listings for available produce', 'Manage offer and fulfilment activity'],
    benefits: ['Present eligible produce in the public marketplace', 'Share listed quantity, grade and district with buyers', 'Make harvest information easier to discover'],
    registrationPath: '/signup?role=farmer',
    loginPath: '/login?role=farmer',
  },
  {
    role: 'buyer',
    name: 'Buyer',
    description: 'Finds produce, reviews harvest listings and manages purchasing activity.',
    responsibilities: ['Review crop, grade and district information', 'Create procurement demands and offers', 'Track order and receipt activity'],
    benefits: ['Browse eligible harvests in one place', 'Compare listed grades, districts and prices', 'Check current public availability'],
    registrationPath: '/signup?role=buyer',
    loginPath: '/login?role=buyer',
  },
  {
    role: 'driver',
    name: 'Driver',
    description: 'Carries assigned produce and records pickup and delivery activity.',
    responsibilities: ['Maintain vehicle and availability information', 'Complete assigned pickups and trips', 'Record handovers and delivery incidents'],
    benefits: ['Review assigned transport activity', 'Keep pickup and delivery steps coordinated', 'Contribute clear handover records'],
    registrationPath: '/signup?role=driver',
    loginPath: '/login?role=driver',
  },
  {
    role: 'admin',
    name: 'Administrator',
    description: 'Reviews platform access and operational records with authorised access.',
    responsibilities: ['Review account approval activity', 'Monitor authorised operational records', 'Support controlled platform administration'],
    benefits: ['Review account and operational activity', 'Support controlled platform access', 'Keep administrative oversight within authorised workflows'],
    registrationPath: '/login?role=admin',
    loginPath: '/login?role=admin',
  },
];
