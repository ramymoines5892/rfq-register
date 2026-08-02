CREATE OR REPLACE FUNCTION public.generate_company_document_notifications()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _rec RECORD;
  _target RECORD;
  _days_left integer;
  _threshold integer;
  _repeat public.doc_notify_repeat;
  _depts uuid[];
  _min_gap interval;
  _should_notify boolean;
  _title text;
  _body text;
  _kind text;
  _priority text;
  _count integer := 0;
BEGIN
  FOR _rec IN
    SELECT DISTINCT ON (d.type_id)
      d.id, d.type_id, d.company_id, d.expiry_date, d.department_ids,
      d.notify_days_before, d.notify_repeat, d.last_notified_at,
      t.name_ar, t.name_en, t.default_department_ids,
      t.notify_days_before AS t_days, t.notify_repeat AS t_repeat,
      c.doc_expiry_warning_days AS c_days
    FROM public.company_documents d
    JOIN public.company_document_types t ON t.id = d.type_id
    LEFT JOIN public.companies c ON c.id = d.company_id
    WHERE d.superseded_at IS NULL AND d.expiry_date IS NOT NULL
    ORDER BY d.type_id, d.created_at DESC
  LOOP
    _threshold := COALESCE(_rec.notify_days_before, _rec.t_days, _rec.c_days, 30);
    _repeat := COALESCE(_rec.notify_repeat, _rec.t_repeat, 'weekly'::public.doc_notify_repeat);
    _depts := COALESCE(NULLIF(_rec.department_ids, '{}'::uuid[]), _rec.default_department_ids);
    _days_left := (_rec.expiry_date - CURRENT_DATE);

    IF _days_left > _threshold THEN CONTINUE; END IF;

    _min_gap := CASE _repeat
      WHEN 'daily'   THEN interval '20 hours'
      WHEN 'weekly'  THEN interval '6 days 20 hours'
      WHEN 'monthly' THEN interval '29 days'
      ELSE interval '100 years'
    END;
    _should_notify := _rec.last_notified_at IS NULL OR (now() - _rec.last_notified_at) >= _min_gap;
    IF NOT _should_notify THEN CONTINUE; END IF;

    IF _days_left < 0 THEN
      _title := 'مستند منتهي: ' || _rec.name_ar;
      _body := 'انتهت صلاحية "' || _rec.name_ar || '" منذ ' || abs(_days_left) || ' يوم. يرجى رفع النسخة الجديدة.';
      _kind := 'action_required'; _priority := 'high';
    ELSE
      _title := 'اقتراب انتهاء: ' || _rec.name_ar;
      _body := '"' || _rec.name_ar || '" ينتهي خلال ' || _days_left || ' يوم.';
      _kind := 'reminder'; _priority := CASE WHEN _days_left <= 7 THEN 'high' ELSE 'medium' END;
    END IF;

    FOR _target IN
      SELECT DISTINCT p.id AS user_id
      FROM public.profiles p
      WHERE p.status = 'active'::public.profile_status
        AND (
          (p.department_id = ANY(_depts))
          OR public.is_admin_or_owner(p.id)
        )
    LOOP
      INSERT INTO public.notifications (user_id, title, body, link, kind, category, priority, entity_type, entity_id)
      VALUES (_target.user_id, _title, _body, '/documents?doc=' || _rec.id::text,
              _kind, 'company_documents', _priority, 'company_document', _rec.id::text);
      _count := _count + 1;
    END LOOP;

    UPDATE public.company_documents SET last_notified_at = now() WHERE id = _rec.id;
  END LOOP;
  RETURN _count;
END;
$function$;