
const ROLES = ['farmer', 'buyer', 'driver'];

const COMMON_FIELDS = [
  'role',
  'fullName',
  'email',
  'phone',
  'district',
  'password',
];

const ROLE_FIELDS = {
  farmer: ['farmName', 'pickupAddress'],
  buyer: ['buyerType', 'businessName'],
  driver: [
    'operatingArea',
    'vehicleType',
    'registrationNumber',
    'licenceNumber',
    'capacityKg',
  ],
};

const VEHICLE_TYPES = [
  'lgv',
  'mini_lorry',
  'refrigerated',
  'heavy_flatbed',
];

function normalizePhone(value) {
  if (typeof value !== 'string') return null;

  const phone = value.replace(/[\s()-]/g, '');

  if (/^07\d{8}$/.test(phone)) {
    return `+94${phone.slice(1)}`;
  }

  if (/^7\d{8}$/.test(phone)) {
    return `+94${phone}`;
  }

  if (/^\+947\d{8}$/.test(phone)) {
    return phone;
  }

  return null;
}

export function validateRegistration(body) {
  const errors = {};

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    return {
      valid: false,
      errors: { body: 'Invalid request body' },
      value: null,
    };
  }

  const role = body.role;

  if (!ROLES.includes(role)) {
    errors.role = 'Choose farmer, buyer or driver';
  }

  const allowedFields = [
    ...COMMON_FIELDS,
    ...(ROLE_FIELDS[role] || []),
  ];

  for (const field of Object.keys(body)) {
    if (!allowedFields.includes(field)) {
      errors[field] = 'Unsupported field';
    }
  }

  const fullName =
    typeof body.fullName === 'string'
      ? body.fullName.trim()
      : '';

  if (fullName.length < 2 || fullName.length > 150) {
    errors.fullName = 'Enter a valid full name';
  }

  const email =
    typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : '';

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    errors.email = 'Enter a valid email address';
  }

  const phone = normalizePhone(body.phone);

  if (!phone) {
    errors.phone = 'Enter a valid Sri Lankan mobile number';
  }

  const district =
    typeof body.district === 'string'
      ? body.district.trim()
      : '';

  if (!district || district.length > 100) {
    errors.district = 'Select a valid district';
  }

  const password = body.password;

  if (
    typeof password !== 'string' ||
    password.length < 15 ||
    password.length > 128
  ) {
    errors.password = 'Password must contain 15–128 characters';
  }

  const value = {
    role,
    fullName,
    email,
    phone,
    district,
    password,
  };

  if (role === 'farmer') {
    const farmName =
      typeof body.farmName === 'string'
        ? body.farmName.trim()
        : '';

    const pickupAddress =
      typeof body.pickupAddress === 'string'
        ? body.pickupAddress.trim()
        : '';

    if (!farmName || farmName.length > 150) {
      errors.farmName = 'Enter a valid farm name';
    }

    if (!pickupAddress || pickupAddress.length > 500) {
      errors.pickupAddress = 'Enter a pickup address';
    }

    value.farmName = farmName;
    value.pickupAddress = pickupAddress;
  }

  if (role === 'buyer') {
    const buyerType = body.buyerType;

    const businessName =
      typeof body.businessName === 'string'
        ? body.businessName.trim()
        : '';

    if (!['individual', 'commercial'].includes(buyerType)) {
      errors.buyerType = 'Choose a buyer classification';
    }

    if (
      buyerType === 'commercial' &&
      (!businessName || businessName.length > 150)
    ) {
      errors.businessName = 'Enter a valid business name';
    }

    if (buyerType === 'individual' && businessName) {
      errors.businessName =
        'Business name is not applicable to individual buyers';
    }

    value.buyerType = buyerType;
    value.businessName = businessName;
  }

  if (role === 'driver') {
    const operatingArea =
      typeof body.operatingArea === 'string'
        ? body.operatingArea.trim()
        : '';

    const vehicleType = body.vehicleType;

    const registrationNumber =
      typeof body.registrationNumber === 'string'
        ? body.registrationNumber.trim().toUpperCase()
        : '';

    const licenceNumber =
      typeof body.licenceNumber === 'string'
        ? body.licenceNumber.trim().toUpperCase()
        : '';

    const capacityKg = body.capacityKg;

    if (!operatingArea || operatingArea.length > 150) {
      errors.operatingArea = 'Select an operating area';
    }

    if (!VEHICLE_TYPES.includes(vehicleType)) {
      errors.vehicleType = 'Choose a valid vehicle category';
    }

    if (
      !registrationNumber ||
      registrationNumber.length > 30
    ) {
      errors.registrationNumber =
        'Enter a valid vehicle registration number';
    }

    if (!licenceNumber || licenceNumber.length > 50) {
      errors.licenceNumber = 'Enter a driving licence number';
    }

    if (
      typeof capacityKg !== 'number' ||
      !Number.isFinite(capacityKg) ||
      capacityKg <= 0
    ) {
      errors.capacityKg = 'Enter a positive vehicle capacity in kg';
    }

    value.operatingArea = operatingArea;
    value.vehicleType = vehicleType;
    value.registrationNumber = registrationNumber;
    value.licenceNumber = licenceNumber;
    value.capacityKg = capacityKg;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: Object.keys(errors).length === 0 ? value : null,
  };
}
