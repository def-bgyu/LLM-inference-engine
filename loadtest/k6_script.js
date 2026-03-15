import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '30s', target: 50 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<60000'],
    http_req_failed: ['rate<0.1'],
  },
};

const topics = [
  'machine learning', 'Python', 'neural networks', 'the internet',
  'databases', 'algorithms', 'cloud computing', 'Docker', 'APIs',
  'recursion', 'transformers', 'gradient descent', 'backpropagation',
  'reinforcement learning', 'natural language processing', 'Redis',
  'FastAPI', 'Kubernetes', 'distributed systems', 'computer vision'
];

const verbs = ['Explain', 'What is', 'How does', 'Describe', 'Define'];

export default function () {
  let prompt;

  if (Math.random() < 0.3) {
    const repeated = [
      'What is machine learning',
      'Explain Python',
      'What is AI',
      'How does the internet work',
      'What is deep learning',
    ];
    prompt = repeated[Math.floor(Math.random() * repeated.length)];
  } else {
    const verb = verbs[Math.floor(Math.random() * verbs.length)];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    prompt = `${verb} ${topic}`;
  }

  const response = http.post(
    'http://127.0.0.1:8000/generate',
    JSON.stringify({ prompt }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
    'has generated_text': (r) => JSON.parse(r.body).generated_text !== undefined,
    'cached field present': (r) => JSON.parse(r.body).cached !== undefined,
  });

  sleep(1);
}