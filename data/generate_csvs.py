import csv
import json

with open("/Users/k.saidullayev/Desktop/Проекты/Финансы/Jana Men - Документация/data/structure.json", "r", encoding="utf-8") as f:
    depts = json.load(f)

# 1. Employees CSV
emp_rows = []
emp_headers = [
    "ID", "Telegram ID", "ФИО сотрудника", "Блок / Отдел", "Должность", 
    "Непосредственный руководитель", "Директор блока", "Username", "Номер телефона", "Роль в ЭДО", "Дата регистрации"
]

emp_id = 1
for dept in depts:
    d_name = dept["name"]
    d_head = dept.get("head", "")
    d_director = dept.get("director", d_head)
    
    for emp in dept["employees"]:
        fio = emp["name"]
        role = emp["role"]
        
        # System role
        if emp.get("is_boss"):
            sys_role = "Генеральный директор"
            mgr = "-"
            dir_mgr = "-"
        elif emp.get("is_assistant"):
            sys_role = "Бизнес-ассистент"
            mgr = "Кабидуллин Нурсултан Нурланович"
            dir_mgr = "Кабидуллин Нурсултан Нурланович"
        elif emp.get("is_chief_accountant"):
            sys_role = "Главный бухгалтер"
            mgr = "Кабидуллин Нурсултан Нурланович"
            dir_mgr = "Кабидуллин Нурсултан Нурланович"
        elif emp.get("is_director"):
            sys_role = "Директор блока"
            mgr = "Кабидуллин Нурсултан Нурланович"
            dir_mgr = "Кабидуллин Нурсултан Нурланович"
        elif emp.get("is_head"):
            sys_role = "Руководитель отдела"
            mgr = d_director
            dir_mgr = d_director
        else:
            sys_role = "Исполнитель"
            mgr = d_head
            dir_mgr = d_director
            
        emp_rows.append([
            emp_id, "", fio, d_name, role, mgr, dir_mgr, "", "", sys_role, "04.11.2026"
        ])
        emp_id += 1

with open("/Users/k.saidullayev/Desktop/Проекты/Финансы/Jana Men - Документация/data/employees_registry.csv", "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(emp_headers)
    writer.writerows(emp_rows)

print(f"Exported {len(emp_rows)} employees to employees_registry.csv")

# 2. Sample Registry of SZ
sz_headers = [
    "№ СЗ", "Дата создания", "Блок / Отдел", "Инициатор", "Со-исполнители", 
    "Тип СЗ", "Краткая суть", "Сумма (KZT)", "Контрагент / Основание", "№ Договора", 
    "Статус согласования", "Статус оплаты", "Юридический статус (Оригинал)", 
    "Текущий согласующий", "Маршрут согласования", "Ссылка на Google Doc", "Ссылка на подписанный скан", "Папка на Google Диске"
]

sz_sample_rows = [
    [
        "СЗ-2026-0001", "02.11.2026 10:15", "Операционный блок", "Аманбаев Арман Ауезханұлы", "Байсейтов Рамазан Алтымбаевич",
        "Оплата", "Аренда помещения склада за ноябрь (ул. Анет Баба 9В, БЦ «Өнер», каб. 82)", "500000",
        "ИП «Алдажуманова А.Т.»", "№82 от 01.09.2026 г.",
        "Утверждено", "Оплачено", "Сдан в архив (Скан прикреплен)",
        "Завершено", "Аманбаев А. -> Шынәсіл Ә. -> Смагулова А. -> Бегалин А. -> Кабидуллин Н.",
        "https://docs.google.com/document/d/1q0KseBU5p3yP2CVPFJJaBQt1XNCb-mTxRBI0fBIEzTY/edit",
        "https://drive.google.com/file/d/sample_scan_sz_0001/view",
        "https://drive.google.com/drive/folders/sample_folder_sz_0001"
    ]
]

with open("/Users/k.saidullayev/Desktop/Проекты/Финансы/Jana Men - Документация/data/sz_registry.csv", "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(sz_headers)
    writer.writerows(sz_sample_rows)

print("Exported sz_registry.csv")

# 3. Sample Registry of Contracts
contracts_headers = [
    "ID", "Блок / Отдел", "№ Договора", "Дата договора", "Срок действия", 
    "Контрагент", "БИН / ИИН", "Предмет договора", "Сумма / Условия", "Ответственный", 
    "Статус", "Ссылка на скан договора"
]

contracts_sample_rows = [
    [
        1, "Операционный блок", "№82", "01.09.2026", "01.09.2027",
        "ИП «Алдажуманова А.Т.»", "850214300451", "Аренда основного склада Астана (Анет Баба 9В)", "500 000 ₸ / месяц", "Аманбаев Арман Ауезханұлы",
        "Действует", "https://drive.google.com/file/d/sample_contract_82/view"
    ],
    [
        2, "Отдел логистики", "№14-FL", "15.05.2026", "31.12.2026",
        "ТОО «Fast Logistic»", "210440019283", "Курьерские услуги и межгород доставка", "По тарифам экспедирования", "Абенова Дана Талгатовна",
        "Действует", "https://drive.google.com/file/d/sample_contract_14/view"
    ],
    [
        3, "Отдел маркетинга", "№07-ADV", "10.08.2026", "31.12.2026",
        "ТОО «Digital Production»", "190540032111", "Создание медиа-контента и фотосессии витаминов", "1 200 000 ₸", "Қыпшақбаев Темірлан Қайратұлы",
        "Действует", "https://drive.google.com/file/d/sample_contract_07/view"
    ]
]

with open("/Users/k.saidullayev/Desktop/Проекты/Финансы/Jana Men - Документация/data/contracts_registry.csv", "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(contracts_headers)
    writer.writerows(contracts_sample_rows)

print("Exported contracts_registry.csv")
