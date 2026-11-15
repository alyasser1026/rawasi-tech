-- Auto-assign item_code for material_items if NULL or empty, preventing unique constraint violations
CREATE OR REPLACE FUNCTION public.assign_material_item_code()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_max_num integer;
  v_next_num integer;
BEGIN
  IF NEW.item_code IS NULL OR trim(NEW.item_code) = '' THEN
    SELECT COALESCE(MAX(
      NULLIF(regexp_replace(item_code, '^.*?(\d+)$', '\1'), '')::integer
    ), 0)
    INTO v_max_num
    FROM public.material_items
    WHERE item_code ~ '^MAT-\d+$';

    v_next_num := v_max_num + 1;
    NEW.item_code := 'MAT-' || lpad(v_next_num::text, 3, '0');
  ELSE
    NEW.item_code := trim(NEW.item_code);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_material_item_code ON public.material_items;
CREATE TRIGGER trg_assign_material_item_code
BEFORE INSERT OR UPDATE ON public.material_items
FOR EACH ROW
EXECUTE FUNCTION public.assign_material_item_code();
