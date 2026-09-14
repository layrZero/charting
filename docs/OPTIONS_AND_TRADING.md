# Options and trading workflow

Select an underlying and expiry returned by IMC, then request its exact option
chain. The view shows CE/PE LTP and OI around IMC's ATM strike and refreshes
every 30 seconds. Choosing a contract opens it in the OpenAlgo chart.

Greeks, actual strikes and synthetic futures remain IMC-backed data operations;
they are not fabricated in the browser. The order ticket reads analyzer/live
state before submit and sends BUY/SELL, quantity, product and price type only
after explicit user action. Mobile uses the same safeguards and is not
read-only.
