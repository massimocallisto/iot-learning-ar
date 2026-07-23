import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VieweComponent } from './viewe.component';

describe('VieweComponent', () => {
  let component: VieweComponent;
  let fixture: ComponentFixture<VieweComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VieweComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VieweComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
