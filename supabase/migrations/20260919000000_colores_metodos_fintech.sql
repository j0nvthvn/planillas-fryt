-- Rediseño Fintech de la v2: los colores de método que venían del tema café
-- (transferencia = café de marca, efectivo y getnet = verde y azul viejos)
-- pasan a la paleta nueva. Solo se tocan los valores de la semilla: si la
-- dueña ya cambió un color, se respeta. La app actual (raíz) no lee esta
-- columna; la v2 la usa en las barras de Hoy y Análisis y en el ícono de
-- respaldo de los métodos sin logo.
update public.metodos_pago set color = '#047857' where key = 'efectivo'      and upper(color) = '#1E7A4F';
update public.metodos_pago set color = '#7C3AED' where key = 'getnet'        and upper(color) = '#33518C';
update public.metodos_pago set color = '#4F46E5' where key = 'transferencia' and upper(color) = '#5C3317';
