import { badRequest } from './errors.js';

const MINORS =
  /\b(child(ren)?|kids?|minors?|underage|teen(s|age|ager)?|pre-?teen|toddler|infant|bab(y|ies)|loli(con)?|shota(con)?|school\s?(girl|boy)|jailbait|ni[nñ][oa]s?|menor(es)?|adolescentes?|infantil|colegiala|beb[eé]s?|(1[0-7]|[1-9])\s?(yo|y\/o|years?[\s-]old|a[nñ]os))\b/i;
const SEXUAL =
  /\b(nude|naked|nsfw|sex(y|ual)?|porn\w*|hentai|erotic\w*|lewd|topless|breasts?|boobs?|nipples?|genital\w*|penis|vagina|pussy|cock|cum|lingerie|underwear|bikini|desnud[oa]s?|sexo|tetas|pechos|pene|er[oó]tic[oa]s?|lencer[ií]a)\b/i;

export function assertSafePrompt(prompt, { adult }) {
  if (MINORS.test(prompt) && (adult || SEXUAL.test(prompt))) {
    throw badRequest('Prompt rechazado: no se generan menores en contenido adulto', 'prompt_rejected');
  }
}
