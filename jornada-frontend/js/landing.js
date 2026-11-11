// Landing: monta navbar/rodapé, preenche os dados do evento (vindos de config.js) e acorda o servidor.
import { API_URL, EVENTO } from './config.js';
import { montarLayout } from './layout.js';
montarLayout({ ativo: 'inicio' });
document.querySelectorAll('[data-evento]').forEach(el => { el.textContent = EVENTO[el.dataset.evento] + (el.dataset.sufixo || ''); });
// Planos gratuitos hibernam: um ping silencioso deixa a API pronta quando a pessoa chegar na inscrição.
fetch(`${API_URL}/api/saude`, { mode: 'no-cors' }).catch(() => {});
