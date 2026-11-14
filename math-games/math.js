// Recursive descent keeps typed expressions and keypad input on the same path.
function calculate(expression) {
  const input = expression.trim().replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-');
  if (!input || input.length > 200) throw Error('Enter an expression');
  let pos = 0;
  function take(char) {
    while (pos < input.length && /\s/.test(input[pos])) pos++;
    if (input[pos] !== char) return false;
    pos++;
    return true;
  }
  function factor() {
    if (take('-')) return -factor();
    if (take('+')) return factor();
    if (take('(')) {
      const result = sum();
      if (!take(')')) throw Error('Missing closing parenthesis');
      return result;
    }
    const number = input.slice(pos).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
    if (!number) throw Error('Check the expression');
    pos += number[0].length;
    return Number(number[0]);
  }
  function product() {
    let result = factor();
    while (true) {
      if (take('*')) result *= factor();
      else if (take('/')) {
        const divisor = factor();
        if (!divisor) throw Error('Cannot divide by zero');
        result /= divisor;
      } else return result;
    }
  }
  function sum() {
    let result = product();
    while (true) {
      if (take('+')) result += product();
      else if (take('-')) result -= product();
      else return result;
    }
  }
  const result = sum();
  if (pos !== input.length) throw Error('Check the expression');
  if (!Number.isFinite(result)) throw Error('Result out of range');
  return Number(result.toPrecision(14));
}

const expression = document.querySelector('#expression');
const answer = document.querySelector('#answer');
function solve() {
  try {
    const value = calculate(expression.value);
    answer.textContent = expression.value + ' = ' + value;
    expression.value = String(value);
  } catch (error) { answer.textContent = error.message; }
}
document.querySelector('#calcForm').onsubmit = event => {event.preventDefault(); solve();};
expression.oninput = () => {answer.textContent = '';};
document.querySelector('.keys').onclick = event => {
  const key = event.target.closest('button')?.dataset.key;
  if (!key) return;
  if (key === '=') return solve();
  if (key === 'AC') expression.value = '';
  else {
    const end = expression.selectionEnd;
    const start = expression.selectionStart;
    if (key === '⌫') expression.setRangeText('', start === end ? Math.max(0,start-1) : start, end, 'end');
    else if (expression.value.length - (end-start) < 200) expression.setRangeText(key,start,end,'end');
  }
  answer.textContent = '';
};
const cards = [...document.querySelectorAll('#mathCards .card')];
document.querySelector('.filters').onclick = event => {
  const selected = event.target.closest('button');
  if (!selected) return;
  document.querySelectorAll('.filters button').forEach(button => button.setAttribute('aria-pressed',String(button === selected)));
  for (const card of cards) card.hidden = selected.textContent !== 'All games' && card.dataset.topic !== selected.textContent;
  document.querySelector('#total').textContent = cards.filter(card => !card.hidden).length + ' games';
};
for (const image of document.querySelectorAll('#mathCards img')) {
  image.onerror = () => {image.hidden = true;};
  if (image.complete && !image.naturalWidth) image.hidden = true;
}
