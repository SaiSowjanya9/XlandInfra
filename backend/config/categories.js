const categories = [
  {
    id: 1,
    name: 'Lifts',
    subcategories: [
      'Stopped',
      'Not moving',
      'Door stuck',
      'Unusual noise',
      'Emergency alarm issue',
      'Lift shaking / jerking',
      'Other'
    ]
  },
  {
    id: 2,
    name: 'Drainage',
    subcategories: [
      'Drain blocked',
      'Slow drainage',
      'Drain overflow',
      'Backflow issue',
      'Rainwater not clearing',
      'Pipe damage',
      'Other'
    ]
  },
  {
    id: 3,
    name: 'Septic Cleaning',
    subcategories: [
      'Septic tank full',
      'Bad smell',
      'Overflow',
      'Blockage',
      'Slow outflow',
      'Leakage around tank',
      'Cleaning required',
      'Inspection required',
      'Lid damage',
      'Emergency service needed',
      'Other'
    ]
  },
  {
    id: 4,
    name: 'Generator',
    subcategories: [
      'Not starting',
      'Low power output',
      'Fuel leakage',
      'Battery problem',
      'Unusual noise',
      'Smoke issue',
      'Auto start not working',
      'Overheating',
      'Service due',
      'Electrical trip issue',
      'Other'
    ]
  },
  {
    id: 5,
    name: 'Water Tank Cleaning',
    subcategories: [
      'Cleaning required',
      'Dirty water',
      'Bad smell',
      'Algae formation',
      'Tank leakage',
      'Inlet problem',
      'Outlet problem',
      'Lid damage',
      'Overflow issue',
      'Other'
    ]
  },
  {
    id: 6,
    name: 'AC',
    subcategories: [
      'Not cooling',
      'Low cooling',
      'Water leakage',
      'Not turning on',
      'Unusual noise',
      'Bad smell',
      'Remote not working',
      'Gas refill needed',
      'Airflow issue',
      'Service / maintenance required',
      'Other'
    ]
  },
  {
    id: 7,
    name: 'Electrical',
    subcategories: [
      'Power outage',
      'Switch not working',
      'Socket not working',
      'MCB tripping',
      'Light not working',
      'Fan not working',
      'Wiring issue',
      'Burning smell',
      'Short circuit issue',
      'New electrical work needed',
      'Other'
    ]
  },
  {
    id: 8,
    name: 'Plumbing',
    subcategories: [
      'Water leakage',
      'Tap issue',
      'Pipe burst',
      'Low water pressure',
      'Drain blockage',
      'Flush not working',
      'Sink problem',
      'Toilet problem',
      'Valve issue',
      'New plumbing work needed',
      'Other'
    ]
  },
  {
    id: 9,
    name: 'Appliances',
    applianceTypes: [
      'Refrigerator',
      'Washing Machine',
      'Dishwasher',
      'Microwave / Oven',
      'Chimney / Exhaust',
      'TV',
      'Water Dispenser',
      'Dryer'
    ],
    subcategories: [
      'Not working',
      'Not turning on',
      'Unusual noise',
      'Button / control issue',
      'Installation needed',
      'Service required',
      'Other'
    ]
  },
  {
    id: 10,
    name: 'Building Exterior',
    subcategories: [
      'Other'
    ]
  },
  {
    id: 11,
    name: 'Locks / Keys',
    subcategories: [
      'Lock not working',
      'Key lost',
      'Key broken',
      'Door jammed',
      'Lock replacement needed',
      'Smart lock issue',
      'Handle issue',
      'Latch issue',
      'Emergency lock opening',
      'Other'
    ]
  },
  {
    id: 12,
    name: 'Painting',
    subcategories: [
      'Repainting needed',
      'Paint peeling',
      'Wall stains',
      'Color fading',
      'Crack filling needed',
      'Exterior painting needed',
      'Interior painting needed',
      'Touch-up required',
      'Ceiling paint issue',
      'Other'
    ]
  },
  {
    id: 13,
    name: 'Pest Control',
    subcategories: [
      'Cockroach issue',
      'Mosquito issue',
      'Termite issue',
      'Bed bug issue',
      'General pest treatment needed',
      'Repeat treatment needed',
      'Outdoor pest issue',
      'Emergency infestation complaint',
      'Other'
    ]
  },
  {
    id: 14,
    name: 'Water Purification',
    subcategories: [
      'Purifier not working',
      'No water output',
      'Low water flow',
      'Water taste issue',
      'Filter replacement needed',
      'Leakage issue',
      'Power issue',
      'Service required',
      'Installation needed',
      'Other'
    ]
  },
  {
    id: 15,
    name: 'Hot Water Geyser',
    subcategories: [
      'Not heating',
      'Low hot water',
      'Water leakage',
      'Not turning on',
      'Thermostat issue',
      'Pressure issue',
      'Unusual noise',
      'Power issue',
      'Service required',
      'Replacement needed',
      'Other'
    ]
  }
];

module.exports = categories;
