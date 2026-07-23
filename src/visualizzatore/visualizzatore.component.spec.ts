import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VisualizzatoreComponent } from './visualizzatore.component';

describe('VisualizzatoreComponent', () => {
  let component: VisualizzatoreComponent;
  let fixture: ComponentFixture<VisualizzatoreComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VisualizzatoreComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VisualizzatoreComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
