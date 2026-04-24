const categories = [
  {
    id: 1,
    name: 'Lifts',
    subcategories: [
      { id: 101, name: 'Stopped' },
      { id: 102, name: 'Not moving' },
      { id: 103, name: 'Door stuck' },
      { id: 104, name: 'Unusual noise' },
      { id: 105, name: 'Emergency alarm issue' },
      { id: 106, name: 'Lift shaking / jerking' },
      { id: 199, name: 'Other' }
    ]
  },
  {
    id: 2,
    name: 'Drainage',
    subcategories: [
      { id: 201, name: 'Drain blocked' },
      { id: 202, name: 'Slow drainage' },
      { id: 203, name: 'Drain overflow' },
      { id: 204, name: 'Backflow issue' },
      { id: 205, name: 'Rainwater not clearing' },
      { id: 206, name: 'Pipe damage' },
      { id: 299, name: 'Other' }
    ]
  },
  {
    id: 3,
    name: 'Septic Cleaning',
    subcategories: [
      { id: 301, name: 'Septic tank full' },
      { id: 302, name: 'Bad smell' },
      { id: 303, name: 'Overflow' },
      { id: 304, name: 'Blockage' },
      { id: 305, name: 'Slow outflow' },
      { id: 306, name: 'Leakage around the tank' },
      { id: 307, name: 'Cleaning required' },
      { id: 308, name: 'Inspection required' },
      { id: 309, name: 'Lid damage' },
      { id: 310, name: 'Emergency service needed' },
      { id: 399, name: 'Other' }
    ]
  },
  {
    id: 4,
    name: 'Generator',
    subcategories: [
      { id: 401, name: 'Not starting' },
      { id: 402, name: 'Low power output' },
      { id: 403, name: 'Fuel leakage' },
      { id: 404, name: 'Battery problem' },
      { id: 405, name: 'Unusual noise' },
      { id: 406, name: 'Smoke issue' },
      { id: 407, name: 'Auto start not working' },
      { id: 408, name: 'Overheating' },
      { id: 409, name: 'Service due' },
      { id: 410, name: 'Electrical trip issue' },
      { id: 499, name: 'Other' }
    ]
  },
  {
    id: 5,
    name: 'Water Tank Cleaning',
    subcategories: [
      { id: 501, name: 'Cleaning required' },
      { id: 502, name: 'Dirty water' },
      { id: 503, name: 'Bad smell' },
      { id: 504, name: 'Algae formation' },
      { id: 505, name: 'Tank leakage' },
      { id: 506, name: 'Inlet problem' },
      { id: 507, name: 'Outlet problem' },
      { id: 508, name: 'Lid damage' },
      { id: 509, name: 'Overflow issue' },
      { id: 599, name: 'Other' }
    ]
  },
  {
    id: 6,
    name: 'AC',
    subcategories: [
      { id: 601, name: 'Not cooling' },
      { id: 602, name: 'Low cooling' },
      { id: 603, name: 'Water leakage' },
      { id: 604, name: 'Not turning on' },
      { id: 605, name: 'Unusual noise' },
      { id: 606, name: 'Bad smell' },
      { id: 607, name: 'Remote not working' },
      { id: 608, name: 'Gas refill needed' },
      { id: 609, name: 'Airflow issue' },
      { id: 610, name: 'Service/maintenance required' },
      { id: 699, name: 'Other' }
    ]
  },
  {
    id: 7,
    name: 'Electrical',
    subcategories: [
      { id: 701, name: 'Power outage' },
      { id: 702, name: 'Switch not working' },
      { id: 703, name: 'Socket not working' },
      { id: 704, name: 'MCB tripping' },
      { id: 705, name: 'Light not working' },
      { id: 706, name: 'Fan not working' },
      { id: 707, name: 'Wiring issue' },
      { id: 708, name: 'Burning smell' },
      { id: 709, name: 'Short circuit issue' },
      { id: 710, name: 'New electrical work is needed' },
      { id: 799, name: 'Other' }
    ]
  },
  {
    id: 8,
    name: 'Plumbing',
    subcategories: [
      { id: 801, name: 'Water leakage' },
      { id: 802, name: 'Tap issue' },
      { id: 803, name: 'Pipe burst' },
      { id: 804, name: 'Low water pressure' },
      { id: 805, name: 'Drain blockage' },
      { id: 806, name: 'Flush not working' },
      { id: 807, name: 'Sink problem' },
      { id: 808, name: 'Toilet problem' },
      { id: 809, name: 'Valve issue' },
      { id: 810, name: 'New plumbing work is needed' },
      { id: 899, name: 'Other' }
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
      { id: 901, name: 'Not working' },
      { id: 902, name: 'Not turning on' },
      { id: 903, name: 'Unusual noise' },
      { id: 904, name: 'Button/control issue' },
      { id: 905, name: 'Installation needed' },
      { id: 906, name: 'Service required' },
      { id: 999, name: 'Other' }
    ]
  },
  {
    id: 10,
    name: 'Building Exterior',
    subcategories: [
      { id: 1001, name: 'Wall damage' },
      { id: 1002, name: 'Roof leakage' },
      { id: 1003, name: 'Window issue' },
      { id: 1004, name: 'Door issue' },
      { id: 1005, name: 'Parking area issue' },
      { id: 1006, name: 'Gate/fence issue' },
      { id: 1007, name: 'Lighting issue' },
      { id: 1099, name: 'Other' }
    ]
  },
  {
    id: 11,
    name: 'Building Interior',
    subcategories: [
      { id: 1101, name: 'Wall damage' },
      { id: 1102, name: 'Ceiling issue' },
      { id: 1103, name: 'Door issue' },
      { id: 1104, name: 'Window issue' },
      { id: 1105, name: 'Staircase issue' },
      { id: 1106, name: 'Handrail issue' },
      { id: 1107, name: 'Common area issue' },
      { id: 1199, name: 'Other' }
    ]
  },
  {
    id: 12,
    name: 'Flooring',
    subcategories: [
      { id: 1201, name: 'Tile broken' },
      { id: 1202, name: 'Tile loose' },
      { id: 1203, name: 'Floor uneven' },
      { id: 1204, name: 'Grout issue' },
      { id: 1205, name: 'Marble/granite damage' },
      { id: 1206, name: 'Wooden floor issue' },
      { id: 1207, name: 'Carpet issue' },
      { id: 1208, name: 'Floor cleaning required' },
      { id: 1299, name: 'Other' }
    ]
  },
  {
    id: 13,
    name: 'Locks / Keys',
    subcategories: [
      { id: 1301, name: 'Lock not working' },
      { id: 1302, name: 'Key lost' },
      { id: 1303, name: 'Key broken' },
      { id: 1304, name: 'Door jammed' },
      { id: 1305, name: 'Lock replacement needed' },
      { id: 1306, name: 'Smart lock issue' },
      { id: 1307, name: 'Handle issue' },
      { id: 1308, name: 'Latch issue' },
      { id: 1309, name: 'Emergency lock opening' },
      { id: 1399, name: 'Other' }
    ]
  },
  {
    id: 14,
    name: 'Painting',
    subcategories: [
      { id: 1401, name: 'Repainting needed' },
      { id: 1402, name: 'Paint peeling' },
      { id: 1403, name: 'Wall stains' },
      { id: 1404, name: 'Color fading' },
      { id: 1405, name: 'Crack filling needed' },
      { id: 1406, name: 'Exterior painting needed' },
      { id: 1407, name: 'Interior painting needed' },
      { id: 1408, name: 'Touch-up required' },
      { id: 1409, name: 'Ceiling paint issue' },
      { id: 1499, name: 'Other' }
    ]
  },
  {
    id: 15,
    name: 'Pest Control',
    subcategories: [
      { id: 1501, name: 'Cockroach issue' },
      { id: 1502, name: 'Mosquito issue' },
      { id: 1503, name: 'Termite issue' },
      { id: 1504, name: 'Bed bug issue' },
      { id: 1505, name: 'General pest treatment needed' },
      { id: 1506, name: 'Repeat treatment needed' },
      { id: 1507, name: 'Outdoor pest issue' },
      { id: 1508, name: 'Emergency infestation complaint' },
      { id: 1599, name: 'Other' }
    ]
  },
  {
    id: 16,
    name: 'Water Purification',
    subcategories: [
      { id: 1601, name: 'Purifier not working' },
      { id: 1602, name: 'No water output' },
      { id: 1603, name: 'Low water flow' },
      { id: 1604, name: 'Water taste issue' },
      { id: 1605, name: 'Filter replacement needed' },
      { id: 1606, name: 'Leakage issue' },
      { id: 1607, name: 'Power issue' },
      { id: 1608, name: 'Service required' },
      { id: 1609, name: 'Installation needed' },
      { id: 1699, name: 'Other' }
    ]
  },
  {
    id: 17,
    name: 'Hot Water Geyser',
    subcategories: [
      { id: 1701, name: 'Not heating' },
      { id: 1702, name: 'Low hot water' },
      { id: 1703, name: 'Water leakage' },
      { id: 1704, name: 'Not turning on' },
      { id: 1705, name: 'Thermostat issue' },
      { id: 1706, name: 'Pressure issue' },
      { id: 1707, name: 'Unusual noise' },
      { id: 1708, name: 'Power issue' },
      { id: 1709, name: 'Service required' },
      { id: 1710, name: 'Replacement needed' },
      { id: 1799, name: 'Other' }
    ]
  }
];

module.exports = categories;
