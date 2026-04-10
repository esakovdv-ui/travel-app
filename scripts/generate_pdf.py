#!/usr/bin/env python3
"""
Мои Путешествия — генератор PDF-документа для туриста
Запуск:
  python3 generate_pdf.py trip_data.json output.pdf
  python3 generate_pdf.py trip_data.json  # сохранит в /tmp/trip_<order_id>.pdf
"""

import sys
import json
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Flowable

# — Шрифты — путь можно вынести в ENV ———————————————————————————————————
FONT_DIR = os.environ.get('FONT_DIR', os.path.join(os.path.dirname(__file__), 'fonts'))

pdfmetrics.registerFont(TTFont("Sans",          f"{FONT_DIR}/Manrope-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Sans-Semi",     f"{FONT_DIR}/Manrope-SemiBold.ttf"))
pdfmetrics.registerFont(TTFont("Heading-Bold",  f"{FONT_DIR}/Unbounded-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Heading-Black", f"{FONT_DIR}/Unbounded-Black.ttf"))
pdfmetrics.registerFont(TTFont("Heading-Med",   f"{FONT_DIR}/Unbounded-Medium.ttf"))

# — Цвета бренда ——————————————————————————————————————————————————————————
BLUE  = colors.HexColor('#1B4FBF')
YELLOW= colors.HexColor('#F5C000')
RED   = colors.HexColor('#e8272a')
BLACK = colors.HexColor('#111111')
LGRAY = colors.HexColor('#F4F4F4')
MGRAY = colors.HexColor('#DDDDDD')
DGRAY = colors.HexColor('#666666')
GREEN = colors.HexColor('#1A7A1A')
AMBER = colors.HexColor('#A07800')
WHITE = colors.white

# Цвет акцента для дня маршрута по ключу
DAY_COLORS = {
    'blue': BLUE, 'red': RED, 'amber': AMBER, 'green': GREEN, 'yellow': AMBER
}

def make_style(font='Sans', size=9, color=BLACK, align=TA_LEFT, leading=13, sb=0, sa=2):
    return ParagraphStyle('s', fontName=font, fontSize=size, textColor=color,
                          alignment=align, leading=leading, spaceBefore=sb, spaceAfter=sa)

# — Иконки ————————————————————————————————————————————————————————————————

def icon_plane(c, x, y, r, col=WHITE):
    c.saveState(); c.translate(x, y); c.setFillColor(col)
    p=c.beginPath(); p.moveTo(0,r); p.lineTo(-r*.1,-r*.3); p.lineTo(r*.1,-r*.3); p.close(); c.drawPath(p,fill=1,stroke=0)
    p2=c.beginPath(); p2.moveTo(-r*.08,r*.1); p2.lineTo(-r*.55,-r*.05); p2.lineTo(-r*.08,-r*.1); p2.close(); c.drawPath(p2,fill=1,stroke=0)
    p3=c.beginPath(); p3.moveTo(r*.08,r*.1); p3.lineTo(r*.55,-r*.05); p3.lineTo(r*.08,-r*.1); p3.close(); c.drawPath(p3,fill=1,stroke=0)
    c.restoreState()

def icon_warn(c, x, y, r, col=RED):
    c.saveState(); c.translate(x, y); c.setFillColor(col)
    p=c.beginPath(); p.moveTo(0,r*.9); p.lineTo(-r*.8,-r*.6); p.lineTo(r*.8,-r*.6); p.close(); c.drawPath(p,fill=1,stroke=0)
    c.setFillColor(WHITE); c.setFont('Heading-Bold',r*1.6); c.drawCentredString(0,-r*.45,'!')
    c.restoreState()

def icon_ok(c, x, y, r, col=BLUE):
    c.saveState(); c.translate(x, y); c.setFillColor(col); c.circle(0,0,r*.8,fill=1,stroke=0)
    c.setStrokeColor(WHITE); c.setLineWidth(r*.18); c.setLineCap(1)
    p=c.beginPath(); p.moveTo(-r*.35,0); p.lineTo(-r*.05,-r*.32); p.lineTo(r*.38,r*.28); c.drawPath(p,fill=0,stroke=1)
    c.restoreState()

def icon_key(c, x, y, r, col=BLUE):
    c.saveState(); c.translate(x, y); c.setFillColor(col); c.setStrokeColor(col); c.setLineWidth(r*.35)
    c.circle(0,r*.35,r*.45,fill=0,stroke=1); c.setFillColor(WHITE); c.circle(0,r*.35,r*.18,fill=1,stroke=0)
    c.setFillColor(col); c.rect(-r*.14,-r*.8,r*.28,r*.8,fill=1,stroke=0)
    c.rect(r*.14,-r*.52,r*.2,r*.12,fill=1,stroke=0); c.rect(r*.14,-r*.3,r*.17,r*.12,fill=1,stroke=0)
    c.restoreState()

# — Flowables —————————————————————————————————————————————————————————————

class SupremBar(Flowable):
    def __init__(self, w=160*mm):
        Flowable.__init__(self); self.width=w; self.height=7*mm
    def draw(self):
        c=self.canv
        c.setFillColor(RED);   c.rect(0,3.5*mm,self.width*.52,3*mm,fill=1,stroke=0)
        c.setFillColor(BLUE);  c.rect(self.width*.09,0,self.width*.38,3*mm,fill=1,stroke=0)
        c.setFillColor(YELLOW);c.circle(self.width*.5,3.5*mm,4*mm,fill=1,stroke=0)

class SupremDivider(Flowable):
    def __init__(self, w=160*mm):
        Flowable.__init__(self); self.width=w; self.height=4*mm
    def draw(self):
        c=self.canv
        c.setFillColor(RED);   c.rect(0,2*mm,self.width*.28,2*mm,fill=1,stroke=0)
        c.setFillColor(BLUE);  c.rect(self.width*.26,0,self.width*.18,2*mm,fill=1,stroke=0)
        c.setFillColor(YELLOW);c.circle(self.width*.46,2*mm,1.8*mm,fill=1,stroke=0)

class DayHeader(Flowable):
    def __init__(self, num, date, subtitle, accent_key, w=160*mm):
        Flowable.__init__(self)
        self.num=str(num); self.date=date; self.sub=subtitle
        self.accent=DAY_COLORS.get(accent_key, BLUE)
        self.width=w; self.height=16*mm
    def draw(self):
        c=self.canv; h=self.height
        c.setFillColor(LGRAY); c.rect(0,0,self.width,h,fill=1,stroke=0)
        c.setFillColor(self.accent); c.rect(0,0,5*mm,h,fill=1,stroke=0)
        c.setFillColor(self.accent); c.circle(13*mm,h/2,5.5*mm,fill=1,stroke=0)
        c.setFillColor(WHITE); c.setFont('Heading-Bold',8); c.drawCentredString(13*mm,h/2-3,self.num)
        c.setFillColor(BLACK); c.setFont('Heading-Bold',9); c.drawString(22*mm,h/2+1.5*mm,self.date)
        c.setFillColor(DGRAY); c.setFont('Sans',8.5); c.drawString(22*mm,h/2-4.5*mm,self.sub)

class FlightStrip(Flowable):
    def __init__(self, label, date, t1, t2, city1, city2, info, w=160*mm):
        Flowable.__init__(self)
        self.label=label; self.date=date; self.t1=t1; self.t2=t2
        self.city1=city1; self.city2=city2; self.info=info
        self.width=w; self.height=24*mm
    def draw(self):
        c=self.canv; h=self.height
        c.setFillColor(BLUE);  c.rect(0,0,self.width,h,fill=1,stroke=0)
        c.setFillColor(YELLOW);c.rect(0,0,3*mm,h,fill=1,stroke=0)
        icon_plane(c,10*mm,h-5*mm,3*mm,col=YELLOW)
        c.setFillColor(YELLOW); c.setFont('Sans-Semi',7)
        c.drawString(16*mm,h-5.5*mm,self.label.upper())
        c.setFillColor(WHITE); c.setFont('Sans',7)
        c.drawRightString(self.width-5*mm,h-5.5*mm,self.date)
        c.setStrokeColor(colors.HexColor('#3060CC')); c.setLineWidth(0.4)
        c.line(5*mm,h-7.5*mm,self.width-5*mm,h-7.5*mm)
        c.setFillColor(WHITE); c.setFont('Heading-Bold',16)
        c.drawString(6*mm,h/2-4.5*mm,self.t1)
        c.drawRightString(self.width-6*mm,h/2-4.5*mm,self.t2)
        icon_plane(c,self.width/2,h/2-1*mm,4*mm,col=YELLOW)
        c.setFillColor(colors.HexColor('#99BBFF')); c.setFont('Sans',7)
        c.drawString(6*mm,5*mm,self.city1)
        c.drawRightString(self.width-6*mm,5*mm,self.city2)
        c.setFillColor(YELLOW); c.setFont('Sans-Semi',6.5)
        c.drawCentredString(self.width/2,5*mm,self.info)

class BookingStrip(Flowable):
    def __init__(self, num, name, cin, cout, addr,
                 bid='', food='', deposit='', phone='', note='', w=160*mm):
        Flowable.__init__(self)
        self.num=str(num); self.name=name; self.cin=cin; self.cout=cout
        self.addr=addr; self.bid=bid; self.food=food
        self.deposit=deposit; self.phone=phone; self.note=note; self.width=w
        rows=4
        if food:    rows+=1
        if deposit: rows+=1
        if note:    rows+=1
        if phone:   rows+=1
        self.height=(8+rows*5)*mm
    def draw(self):
        c=self.canv; h=self.height
        c.setFillColor(WHITE); c.setStrokeColor(MGRAY); c.setLineWidth(0.5)
        c.rect(0,0,self.width,h,fill=1,stroke=1)
        c.setFillColor(YELLOW); c.rect(0,h-5.5*mm,self.width,5.5*mm,fill=1,stroke=0)
        c.setFillColor(BLUE);   c.rect(0,0,3.5*mm,h-5.5*mm,fill=1,stroke=0)
        icon_key(c,self.width-8*mm,h-2.8*mm,2.2*mm,col=BLUE)
        c.setFillColor(BLACK); c.rect(5.5*mm,h-9.5*mm,34*mm,4.5*mm,fill=1,stroke=0)
        c.setFillColor(WHITE); c.setFont('Sans-Semi',7)
        c.drawString(7*mm,h-7.5*mm,f'БРОНЬ  #{self.num}')
        if self.bid:
            c.setFillColor(DGRAY); c.setFont('Sans',6.5)
            c.drawRightString(self.width-5*mm,h-7.5*mm,f'N {self.bid}')
        c.setFillColor(BLACK); c.setFont('Heading-Med',8.5)
        c.drawString(6*mm,h-14*mm,self.name)
        c.setFillColor(DGRAY); c.setFont('Sans',8)
        c.drawString(6*mm,h-19*mm,self.addr)
        c.setFillColor(BLUE); c.setFont('Sans-Semi',8)
        c.drawString(6*mm,h-24.5*mm,f'Заезд:  {self.cin}')
        c.setFillColor(RED)
        c.drawString(88*mm,h-24.5*mm,f'Выезд:  {self.cout}')
        y=h-30.5*mm
        if self.food:
            icon_ok(c,9*mm,y+2*mm,2*mm,col=GREEN)
            c.setFillColor(GREEN); c.setFont('Sans-Semi',8)
            c.drawString(13*mm,y,f'Питание: {self.food}'); y-=5.5*mm
        if self.deposit:
            icon_warn(c,9*mm,y+2.5*mm,2*mm,col=RED)
            c.setFillColor(RED); c.setFont('Sans',7.5)
            c.drawString(13*mm,y,f'Депозит при заезде: {self.deposit}'); y-=5.5*mm
        if self.note:
            c.setFillColor(DGRAY); c.setFont('Sans',7.5)
            note=self.note if len(self.note)<92 else self.note[:89]+'...'
            c.drawString(7*mm,y,note); y-=5.5*mm
        if self.phone:
            c.setFillColor(DGRAY); c.setFont('Sans',7.5)
            c.drawString(7*mm,y,self.phone)

class NotesTable(Flowable):
    def __init__(self, rows, w=160*mm):
        Flowable.__init__(self); self.rows=rows; self.width=w
        self.rh=11*mm; self.height=len(rows)*self.rh
    def draw(self):
        c=self.canv; tot=self.height
        c.setStrokeColor(MGRAY); c.setLineWidth(0.5)
        c.rect(0,0,self.width,tot,fill=0,stroke=1)
        for i,(kind,title,text) in enumerate(self.rows):
            y=tot-(i+1)*self.rh
            c.setFillColor(LGRAY if i%2==0 else WHITE)
            c.rect(0,y,self.width,self.rh,fill=1,stroke=0)
            c.setFillColor(RED if kind=='warn' else BLUE)
            c.rect(0,y,3.5*mm,self.rh,fill=1,stroke=0)
            if i>0:
                c.setStrokeColor(MGRAY); c.setLineWidth(0.3)
                c.line(0,y+self.rh,self.width,y+self.rh)
            mid=y+self.rh/2
            if kind=='warn': icon_warn(c,9.5*mm,mid,2.5*mm,col=RED)
            else:            icon_ok(c,9.5*mm,mid,2.5*mm,col=BLUE)
            c.setFillColor(BLACK); c.setFont('Heading-Med',7.5); c.drawString(15*mm,mid+1*mm,title)
            c.setFillColor(DGRAY); c.setFont('Sans',7.5);        c.drawString(15*mm,mid-4*mm,text)

# — Header / Footer (принимает subtitle из данных) ———————————————————————

def make_hf(subtitle):
    def hf(cv, doc):
        cv.saveState(); w,h=A4
        cv.setFillColor(RED);    cv.rect(0,h-10*mm,w*.54,4*mm,fill=1,stroke=0)
        cv.setFillColor(BLUE);   cv.rect(w*.09,h-14*mm,w*.37,4*mm,fill=1,stroke=0)
        cv.setFillColor(YELLOW); cv.circle(w*.49,h-10*mm,6.5*mm,fill=1,stroke=0)
        cv.setFillColor(DGRAY);  cv.setFont('Sans',8)
        cv.drawCentredString(w/2,h-30*mm, subtitle)
        cv.setFillColor(BLUE);   cv.rect(0,0,w,7.5*mm,fill=1,stroke=0)
        cv.setFillColor(YELLOW); cv.rect(0,0,34*mm,7.5*mm,fill=1,stroke=0)
        cv.setFillColor(BLACK);  cv.setFont('Heading-Bold',7); cv.drawString(3.5*mm,2.2*mm,'МОИ ПУТЕШЕСТВИЯ')
        cv.setFillColor(WHITE);  cv.setFont('Sans',7); cv.drawRightString(w-4*mm,2.2*mm,f'Стр. {doc.page}')
        cv.restoreState()
    return hf

# — Главная функция генерации ————————————————————————————————————————————

def generate(data: dict, output_path: str):
    H1  = make_style('Heading-Black',14,BLACK,TA_CENTER,20,4,4)
    SUB = make_style('Sans',9,DGRAY,TA_CENTER,12,0,6)
    SEC = make_style('Heading-Bold',9,BLUE,TA_LEFT,15,10,3)
    STP = make_style('Sans',9,BLACK,TA_LEFT,13,0,1)

    meta      = data['meta']
    passengers= data['passengers']
    flights   = data['flights']
    bookings  = data['bookings']
    itinerary = data['itinerary']
    notes     = data.get('notes', [])

    subtitle = f"Книга путешествия  ·  {meta['destination']}  ·  {meta['dates']}"
    names    = '  ·  '.join(p['name'] for p in passengers)

    doc = SimpleDocTemplate(output_path, pagesize=A4,
        rightMargin=25*mm, leftMargin=25*mm, topMargin=20*mm, bottomMargin=20*mm)

    story = []
    story.append(Spacer(1,20*mm))
    story.append(Paragraph('МОИ ПУТЕШЕСТВИЯ', H1))
    story.append(Paragraph(names, SUB))
    story.append(Spacer(1,4*mm))
    story.append(Spacer(1,6*mm))

    # УЧАСТНИКИ
    story.append(Paragraph('УЧАСТНИКИ', SEC))
    rows = [['Пассажир','Авиакомпания','Рейс туда','Рейс обратно']]
    for p in passengers:
        rows.append([p['name'], p.get('airline',''), p.get('flight_out',''), p.get('flight_back','')])
    t = Table(rows, colWidths=[60*mm,35*mm,30*mm,35*mm])
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),BLUE),('TEXTCOLOR',(0,0),(-1,0),WHITE),
        ('FONTNAME',(0,0),(-1,0),'Heading-Med'),('FONTSIZE',(0,0),(-1,-1),8),
        ('FONTNAME',(0,1),(-1,-1),'Sans'),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[WHITE,LGRAY]),
        ('GRID',(0,0),(-1,-1),.5,MGRAY),('PADDING',(0,0),(-1,-1),5),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
    ]))
    story.append(t); story.append(Spacer(1,6*mm))

    # ПЕРЕЛЁТЫ
    story.append(Paragraph('ПЕРЕЛЁТЫ', SEC))
    for f in flights:
        story.append(FlightStrip(
            f['label'], f['date'],
            f['dep_time'], f['arr_time'],
            f['dep_city'], f['arr_city'],
            f['info']
        ))
        story.append(Spacer(1,3*mm))
    story.append(Spacer(1,3*mm))

    # РАЗМЕЩЕНИЕ
    story.append(Paragraph('РАЗМЕЩЕНИЕ', SEC))
    for i, b in enumerate(bookings, 1):
        story.append(BookingStrip(
            i, b['name'], b['checkin'], b['checkout'], b['address'],
            bid=b.get('booking_id',''),
            food=b.get('food',''),
            deposit=b.get('deposit',''),
            phone=b.get('phone',''),
            note=b.get('note',''),
        ))
        story.append(Spacer(1,3*mm))
    story.append(Spacer(1,3*mm))

    # МАРШРУТ
    story.append(SupremDivider()); story.append(Spacer(1,4*mm))
    story.append(Paragraph('МАРШРУТ ПО ДНЯМ', SEC))

    def stops_table(stops, tc):
        tbl=Table([[Paragraph(s['time'],make_style('Heading-Med',7.5,tc)),
                    Paragraph(s['text'],STP)] for s in stops],
                  colWidths=[20*mm,140*mm])
        tbl.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),
                                  ('PADDING',(0,0),(-1,-1),3),
                                  ('ROWBACKGROUNDS',(0,0),(-1,-1),[WHITE,LGRAY])]))
        return tbl

    for day in itinerary:
        accent = DAY_COLORS.get(day.get('color','blue'), BLUE)
        story.append(DayHeader(day['day'], day['date'], day['subtitle'], day.get('color','blue')))
        story.append(Spacer(1,2*mm))
        if day.get('free_text'):
            story.append(Paragraph(day['free_text'], make_style('Sans',9,BLACK,TA_LEFT,14,3,3)))
        else:
            story.append(stops_table(day['stops'], accent))
        story.append(Spacer(1,4*mm))

    # ЗАМЕТКИ
    if notes:
        story.append(SupremDivider()); story.append(Spacer(1,4*mm))
        story.append(Paragraph('ВАЖНЫЕ ЗАМЕТКИ', SEC))
        story.append(NotesTable([(n['type'], n['title'], n['text']) for n in notes]))
        story.append(Spacer(1,8*mm))

    story.append(Paragraph(
        f"Хорошей поездки!  ·  {meta.get('brand','Мои Путешествия')}",
        make_style('Heading-Med',8,DGRAY,TA_CENTER)
    ))

    hf = make_hf(subtitle)
    doc.build(story, onFirstPage=hf, onLaterPages=hf)
    return output_path


# — CLI ———————————————————————————————————————————————————————————————————

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 generate_pdf.py trip_data.json [output.pdf]")
        sys.exit(1)

    json_path = sys.argv[1]
    with open(json_path, encoding='utf-8') as f:
        data = json.load(f)

    order_id   = data['meta'].get('order_id', 'trip')
    output     = sys.argv[2] if len(sys.argv) > 2 else f"/tmp/trip_{order_id}.pdf"

    result = generate(data, output)
    print(result)  # Node.js читает этот stdout как путь к файлу
